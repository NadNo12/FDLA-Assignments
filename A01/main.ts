// Import necessary libraries and modules
import { Elysia, t } from "elysia";
import { Database } from "bun:sqlite";
import { Eta } from "eta";
import { join } from "path";
import { v4 as uuid } from "uuid";

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

// Create a new Elysia server instance
const app = new Elysia()

    // GET endpoint to display the event form and list all events
    .get("/", () => {
        return new Response(eta.render("./event-form", { success: false, events: getEvents() }), {
            headers: {
                'Content-Type': 'text/html'
            }
        })
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
        })
    })

    // GET endpoint to provide an Atom feed for the events
    .get("/feed", () => {
        return new Response(eta.render("./atom-feed", { events: getEvents(), metadata }), {
            headers: {
                'Content-Type': 'application/atom+xml; charset=utf-8'
            }
        })
    })

    // Start the server on port 3000
    .listen(3000);

// Log a message when the server starts successfully
console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
