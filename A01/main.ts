// Import necessary libraries and modules
import { Elysia, t } from "elysia";
import { swagger } from '@elysiajs/swagger';
import { Database } from "bun:sqlite";
import { Eta } from "eta";
import { join } from "path";
import { v4 as uuid } from "uuid";
import { extract } from '@extractus/feed-extractor'

// Initialize the SQLite database connection
const db = new Database("data.db")

// Configure Eta templating engine with the views directory
const eta = new Eta({ views: join(import.meta.dir, "templates") })

// Create the 'events' table if it doesn't exist
db.query(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT,
    name TEXT,
    title TEXT,
    date TEXT,
    description TEXT,
    created TEXT,
    updated TEXT
)`).run()

// Metadata that can be used for other purposes like feeds
const metadata = {
    lastUpdated: new Date(),
    id: uuid(),
}

/**
 * Fetch all events from the database, sort by date in descending order, 
 * and return them in a processed format
 */
const getEvents = () => {
    const values = db.query(`SELECT * FROM events ORDER BY date DESC`).values()
    const events = values.map(row => ({
        id: row[0],
        uuid: row[1],
        name: row[2],
        title: row[3],
        date: new Date(row[4].toString()).toLocaleString('de'),
        description: row[5],
        created: row[6],
        updated: row[7],
    }))
    return events
}

// Types extracted from example Atom Feed
type Entry = {
    id:          string;
    title:       string;
    link:        {
        "@_href": string;
    };
    published:   string;
    description: string;
    updated:     string;
    summary:     string;
    author:      {
        name: string;
    };
}

const isEntry = (obj: any): obj is Entry => {
    return 'id' in obj && 'title' in obj && 'link' in obj && 'published' in obj && 'description' in obj && 'updated' in obj && 'summary' in obj && 'author' in obj
}


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
    .get("/", () => {
        return new Response(eta.render("./event-form", { success: false, events: getEvents() }), {
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
    .post("/", ({ body }) => {
        const { name, date, description, title } = body;
        db.query(`INSERT INTO events (uuid, name, title, date, description, created, updated) VALUES ($uuid, $name, $title, $date, $description, $created, $updated)`)
            .run({
                $uuid: uuid(),
                $name: name,
                $title: title,
                $date: date,
                $description: description,
                $created: new Date().toISOString(),
                $updated: new Date().toISOString(),
            })
        return new Response(eta.render("./event-form", { success: true, events: getEvents() }), {
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
    .get("/feed", () => {
        return new Response(eta.render("./atom-feed", { events: getEvents(), metadata }), {
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

    .get("/ingest", async ({ query: { url } }) => {
        // Extract events from the Atom feed
        const result = await extract(url, {
            normalization: true,
            useISODateFormat: true,
            getExtraEntryFields: (entry) => entry,
        });

        const { entries } = result;

        // Return error message if there are no events
        if (!entries || entries?.length === 0) {
            throw new Error('Atom feed could not be ingested');
        }

        const existing = getEvents();

        for (const entry of entries) {
            // Check if the entry is a valid event
            if (!isEntry(entry)) continue;
            const { id, title, description, summary, author: { name }, updated, published, link } =  entry;
            // If the event already exists, skip it
            if (existing.some(e => e.uuid === id)) continue;
            // Add the event to the database
            db.query(`INSERT INTO events (uuid, name, title, date, description, created, updated) VALUES ($uuid, $name, $title, $date, $description, $created, $updated)`)
                .run({
                    $uuid: id,
                    $name: name,
                    $title: title,
                    $date: updated,
                    $description: summary,
                    $created: published,
                    $updated: updated,
                })
        }

        return new Response(eta.render("./atom-feed", { events: getEvents(), metadata }), {
            headers: {
                'Content-Type': 'application/atom+xml; charset=utf-8'
            }
        })
    }, {
        query: t.Object({
            url: t.String({ description: 'The URL of the Atom feed to ingest events from' }),
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
