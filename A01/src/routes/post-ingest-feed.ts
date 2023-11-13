import {Elysia, t} from "elysia";
import {appConfig} from "../config.ts";
import {extract, FeedData} from "@extractus/feed-extractor";
import {inspect} from "bun";


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

const isEntry = (entry: any) => {
    return "id" in entry && "title" in entry && "link" in entry && "published" in entry && "description" in entry && "updated" in entry && "author" in entry;
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

        const invalidEntries: any[] = [];

        for (const entry of entries) {
            // Check if the entry is a valid event
            if (!isEntry(entry)) {
                invalidEntries.push(entry);
                continue;
            }

            const transformedEntry = transformEntry(entry);
            if (!transformedEntry) {
                invalidEntries.push(entry);
                continue;
            }
            const {id, title, description, author: {name}, updated, published, link, summary} = transformedEntry;

            // Add the event to the database
            await prisma.event.upsert({
                create: {
                    id,
                    title: title,
                    description: description,
                    summary: summary,
                    createdAt: published,
                    authors: {
                        create: [{name}],
                    },
                    Feed: {
                        connect: {
                            id: feedId,
                        }
                    },
                    link: link,
                    source: {
                        connectOrCreate: {
                            where: {
                                id: canonicalOrigin,
                            },
                            create: {
                                id: canonicalOrigin,
                                title: result.title ? getTextNodeContent(result.title) : `Untitled feed from ${url}`,
                                updatedAt: new Date(),
                            },
                        }
                    }
                },
                update: {
                    updatedAt: new Date(),
                    title: title,
                    description: description,
                    summary: summary,
                    link: link,
                },
                where: {
                    feedId,
                    id,
                }
            }).catch(console.log)
        }

        if (invalidEntries.length > 0) {
            throw new Error(`Not all entries could be processed. Feed: ${ingestUrl}\nMalformed entries:\n\n${invalidEntries.join('\n')}`);
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
