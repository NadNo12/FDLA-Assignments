// Import necessary libraries and modules
import {Elysia, t} from "elysia";
import {swagger} from '@elysiajs/swagger';
import {v4 as uuid} from "uuid";
import {extract} from '@extractus/feed-extractor';
import {Prisma, PrismaClient} from "@prisma/client";
import atomFeed from "./templates/atom-feed.ts";
import eventForm from "./templates/event-form.ts";
import {inspect} from "bun";

// Initialize the SQLite database connection
const prisma = new PrismaClient({
    log: ['warn', 'error'],
    errorFormat: 'pretty',
});

const FEED_ID = process.env.FEED_ID ?? uuid();
const FEED_TITLE = process.env.FEED_TITLE ?? "Example Atom Feed";
const FEED_URL = process.env.FEED_URL ?? "/feed";

const feed = await prisma.feed.upsert({
    create: {
        id: FEED_ID,
        title: FEED_TITLE,
        link: FEED_URL,
    },
    update: {
        updatedAt: new Date(),
        title: FEED_TITLE,
        link: FEED_URL,
    },
    where: {
        id: FEED_ID
    }
});

console.log('Feed metadata', feed);

const cleanUp = async () => {
    return Promise.allSettled([
        prisma.feed.deleteMany({
            where: { id: {not: FEED_ID} }
        }),
        prisma.event.deleteMany({
            where: { OR: [{ feedId: {not: FEED_ID } }, { feedId: null }] }
        }),
        prisma.author.deleteMany({
            where: { OR: [{ feedId: {not: FEED_ID } }, { feedId: null }] }
        }),
    ]).catch(console.log);
};

console.log('Cleaning up');
console.log(await cleanUp());

const getAll = async () => {
    return Promise.allSettled([
        prisma.feed.findMany(),
        prisma.event.findMany(),
        prisma.author.findMany(),
        prisma.source.findMany(),
    ]);
}

console.log('Data')
console.log(inspect(await getAll()))

// Types extracted from example Atom Feed
type Entry = {
    id: string;
    title: string;
    link: {
        "@_href": string;
    };
    published: string;
    description: string;
    updated: string;
    summary: string;
    author: {
        name: string;
    };
}

const isEntry = (obj: any): obj is Entry => {
    return 'id' in obj && 'title' in obj && 'link' in obj && 'published' in obj && 'description' in obj && 'updated' in obj && 'summary' in obj && 'author' in obj
}

const getEvents = async () => {
    return prisma.event.findMany({
        include: {
            authors: true,
            source: true,
        },
        where: {
            feedId: feed.id,
        }
    });
}

export type ReturnedEvents = Prisma.PromiseReturnType<typeof getEvents>;

const getMetadata = async () => {
    return await prisma.feed.findFirst({
        where: {
            id: FEED_ID
        }
    }).then(feed => ({
        id: feed!.id,
        lastUpdated: feed!.updatedAt,
        link: feed!.link,
    }))
}

export type ReturnedMetadata = Prisma.PromiseReturnType<typeof getMetadata>;

// Create a new Elysia server instance
const app = new Elysia()
    // @ts-ignore
    .use(swagger({
        path: '/swagger',
        documentation: {
            info: {
                title: 'Nadjim & Kai\'s Atom Feed Documentation',
                version: '1.0.0'
            },
        }
    }))

    // GET endpoint to display the event form and list all events
    .get("/", async () => {
        return new Response(await eventForm({events: await getEvents(), success: false}), {
            headers: {
                'Content-Type': 'text/html'
            }
        })
    }, {
        detail: {
            summary: 'Endpoint to display the event form and list all events in HTML',
            tags: ['HTML'],
        }
    })

    // POST endpoint to add a new event to the database and redirect to the event form
    .post("/", async ({body}) => {
        const {name, date, description, title} = body;

        await prisma.event.create({
            data: {
                title,
                content: description + '\n' + date,
                authors: {
                    create: [{name}],
                },
                Feed: {
                    connect: {
                        id: feed.id
                    }
                }
            }
        }).catch(console.log)

        return new Response(await eventForm({events: await getEvents(), success: true}), {
            headers: {
                'Content-Type': 'text/html'
            }
        })
    }, {
        // Define the expected body structure for the POST request
        body: t.Object({
            name: t.String(),
            title: t.String(),
            date: t.String(),
            description: t.String()
        }),

        detail: {
            summary: 'Endpoint to add a new event to the database and redirect to the event form',
            tags: ['HTML'],
        }
    })

    // GET endpoint to provide an Atom feed for the events
    .get("/feed", async () => {
        return new Response(await atomFeed({events: await getEvents(), metadata: await getMetadata()}), {
            headers: {
                'Content-Type': 'application/atom+xml; charset=utf-8'
            }
        })
    }, {
        detail: {
            summary: 'Endpoint to provide an Atom feed for the events',
            tags: ['Atom'],
        }
    })

    .get("/ingest", async ({query: {url}}) => {
        const ingestUrl = new URL(url);

        // Extract events from the Atom feed
        const result = await extract(ingestUrl.toString(), {
            normalization: true,
            useISODateFormat: true,
            getExtraEntryFields: (entry) => entry,
        });

        const canonicalOrigin = `${ingestUrl.origin}/`;

        const {entries} = result;

        // Return error message if there are no events
        if (!entries || entries?.length === 0) {
            throw new Error('Atom feed could not be ingested');
        }

        for (const entry of entries) {
            // Check if the entry is a valid event
            if (!isEntry(entry)) continue;
            const {id, title, description, summary, author: {name}, updated, published, link} = entry;

            // Add the event to the database
            await prisma.event.upsert({
                create: {
                    id,
                    title,
                    content: description,
                    createdAt: published,
                    authors: {
                        create: [{name}],
                    },
                    Feed: {
                        connect: {
                            id: feed.id
                        }
                    },
                    link: link["@_href"],
                    source: {
                        connectOrCreate: {
                            where: {
                                id: canonicalOrigin,
                            },
                            create: {
                                id: canonicalOrigin,
                                title: result.title ?? `Untitled feed from ${url}`,
                                updatedAt: new Date(),
                            },
                        }
                    }
                },
                update: {
                    updatedAt: new Date(),
                    title,
                    content: description,
                    link: link["@_href"],
                },
                where: {
                    feedId: feed.id,
                    id,
                }
            }).catch(console.log)
        }

        return new Response(await atomFeed({events: await getEvents(), metadata: await getMetadata()}), {
            headers: {
                'Content-Type': 'application/atom+xml; charset=utf-8'
            }
        })
    }, {
        query: t.Object({
            url: t.String({description: 'The URL of the Atom feed to ingest events from'}),
        }),

        detail: {
            summary: 'Endpoint to ingest events from an Atom feed',
            tags: ['Atom'],
            responses: {
                200: {
                    description: 'Success. Feed was ingested into the database. Returns the new feed',
                },
                404: {
                    description: 'Feed could not be ingested.',
                }
            }
        }
    })

    // Start the server on port 3000
    .listen(3000);

// Log a message when the server starts successfully
console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
