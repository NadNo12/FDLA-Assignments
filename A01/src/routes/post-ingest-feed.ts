import {Elysia, t} from "elysia";
import {Value, ValueError} from "@sinclair/typebox/value";
import {appConfig} from "../config.ts";
import {extract, FeedData} from "@extractus/feed-extractor";
import {inspect} from "bun";

const {Check,Errors} = Value;

type Entry = {
    id:          string;
    title:       string;
    link:        string;
    published:   string;
    description: string;
    updated:     string;
    summary?:    string;
    author:      {
        name: string;
    };
}

type TextNode = {
    "#text": string;
}

const getTextNodeContent = (node: string | TextNode) => {
    return typeof node === "string" ? node : node["#text"];
}

const getAuthorContent = (author: any) => {
    return {
        name: getTextNodeContent(author.name),
    }
}

const transformEntry = (entry: any): Entry | undefined => {
    try {
        return {
            id: getTextNodeContent(entry.id),
            title: getTextNodeContent(entry.title),
            link: entry.link["@_href"],
            published: getTextNodeContent(entry.published),
            description: getTextNodeContent(entry.description),
            updated: getTextNodeContent(entry.updated),
            author: getAuthorContent(entry.author),
            summary: entry.summary ? getTextNodeContent(entry.summary) : undefined,
        }
    } catch (e) {
        throw new Error(`Invalid entry: ${inspect(entry)}`);
    }
}

const linkNodeSchema = t.Object({
    "@_href": t.String(),
})

const textNodeSchema = t.Object({
    "#text": t.String(),
    "@_type": t.String(),
})

const entrySchema = t.Object({
    id: t.String(),
    title: t.Union([t.String(), textNodeSchema]),
    link: t.Union([t.String(), linkNodeSchema]),
    published: t.String(),
    description: t.Union([t.String(), textNodeSchema]),
    summary: t.Optional(t.Union([t.String(), textNodeSchema])),
    updated: t.String(),
    author: t.Object({
        name: t.Union([t.String(), textNodeSchema]),
        uri: t.Optional(t.Union([t.String(), textNodeSchema])),
        email: t.Optional(t.Union([t.String(), textNodeSchema])),
    })
})

export const postIngestFeed = new Elysia()
    .use(appConfig)
    .post("/ingest", async ({body: {url}, store: {prisma, databaseFunctions: {getMetadata}}}) => {
        const ingestUrl = new URL(url);

        // Extract events from the Atom feed
        const result: FeedData | undefined = await extract(ingestUrl.toString(), {
            normalization: true,
            useISODateFormat: true,
            getExtraEntryFields: (entry) => entry,
        }).catch(error => {
            console.log(`Could not parse ${ingestUrl}` ,error);
            return undefined;
        });

        if (!result) {
            throw new Error(`Atom feed could not be ingested. Failed reaching or parsing the feed. Feed: ${ingestUrl}`);
        }

        const canonicalOrigin = `${ingestUrl.origin}/`;

        const {entries} = result;

        // Return error message if there are no events
        if (!entries || entries?.length === 0) {
            throw new Error(`Atom feed could not be ingested. No entries found. Feed: ${ingestUrl}`);
        }

        const {id: feedId} = await getMetadata();

        const schemaErrors: { entry: any, errors: ValueError[] }[] = [];
        const transformErrors: any[] = [];
        const databaseErrors: any[] = [];

        for (const entry of entries) {
            if (!Check(entrySchema, entry)) {
                const errors = Array.from(Errors(entrySchema, entry));
                schemaErrors.push({ entry, errors });
                continue;
            }

            const transformedEntry = transformEntry(entry);
            if (!transformedEntry) {
                transformErrors.push(entry);
                continue;
            }

            const {id, title, description, author: {name}, updated, published, link, summary} = transformedEntry;

            const source = {
                connectOrCreate: {
                    where: {
                        id: canonicalOrigin,
                    },
                    create: {
                        id: canonicalOrigin,
                        ingestUrl: ingestUrl.toString(),
                        title: result.title ? getTextNodeContent(result.title) : `Untitled feed from ${url}`,
                        updatedAt: new Date(),
                    },
                }
            };

            // Add the event to the database
            await prisma.event.upsert({
                create: {
                    id,
                    title: title,
                    description: description,
                    summary: summary,
                    createdAt: published,
                    updatedAt: updated,
                    authors: {
                        create: [{name}],
                    },
                    Feed: {
                        connect: {
                            id: feedId,
                        }
                    },
                    link: link,
                    source: source,
                },
                update: {
                    updatedAt: updated,
                    title: title,
                    description: description,
                    summary: summary,
                    link: link,
                    source: source,
                },
                where: {
                    feedId,
                    id,
                }
            }).catch(error => {
                databaseErrors.push({ url, entry, error });
            })
        }

        if (schemaErrors.length + transformErrors.length) {
            let errorResponse = `Not all entries could be processed.\nFeed:${ingestUrl}\n`;
            if (schemaErrors.length) {
                errorResponse += '\nFailed schema validation:\n';
                errorResponse += schemaErrors.map(({ entry, errors }) => `\nEntry: ${JSON.stringify(entry)}\nErrors: ${JSON.stringify(errors)}`);
            }
            if (transformErrors.length) {
                errorResponse += '\nFailed to transform:\n';
                errorResponse += transformErrors.map(entry => JSON.stringify(entry)).join('\n');
            }
            if (databaseErrors.length) {
                errorResponse += '\nFailed to add to database:\n';
                errorResponse += databaseErrors.map(entry => JSON.stringify(entry)).join('\n');
            }
            throw new Error(errorResponse);
        }

        return new Response("All entries were processed");
    }, {
        body: t.Object({
            url: t.String({description: 'The URL of the Atom feed to ingest events from'}),
        }),

        detail: {
            summary: 'Endpoint to ingest events from an Atom feed',
            tags: ['Atom'],
            responses: {
                200: {
                    description: 'Success. Feed was ingested into the database.',
                },
                400: {
                    description: 'Feed could not be ingested.',
                }
            }
        }
    })
