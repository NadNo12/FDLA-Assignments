import {Elysia, t} from "elysia";
import { v4 as uuid } from "uuid";
import {appConfig} from "../config.ts";
import eventForm from "../templates/event-form.ts";

export const postNewEvent = new Elysia()
    .use(appConfig)
    // POST endpoint to add a new event to the database and redirect to the event form
    .post("/", async ({body, store: { prisma, databaseFunctions: { getEvents, getMetadata } }}) => {
        const {name, date, description, title} = body;

        const {id: feedId} = await getMetadata();

        await prisma.event.create({
            data: {
                id: `urn:uuid:${uuid()}`,
                title,
                description: description,
                summary: description + '\n' + date,
                authors: {
                    create: [{name}],
                },
                Feed: {
                    connect: {
                        id: feedId,
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
