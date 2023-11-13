import {Elysia} from "elysia";
import {appConfig} from "../config.ts";
import atomFeed from "../templates/atom-feed.ts";


export const getAtomFeed = new Elysia()
    .use(appConfig)
    // GET endpoint to provide an Atom feed for the events
    .get("/feed", async ({ store: { databaseFunctions: { getEvents, getMetadata}}}) => {
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
