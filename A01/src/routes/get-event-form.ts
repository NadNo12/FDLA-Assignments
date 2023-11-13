import {Elysia} from "elysia";
import {appConfig} from "../config.ts";
import eventForm from "../templates/event-form.ts";

export const getEventForm = new Elysia()
    .use(appConfig)
    // GET endpoint to display the event form and list all events
    .get("/", async ({ store: {databaseFunctions: {getEvents}} }) => {
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
