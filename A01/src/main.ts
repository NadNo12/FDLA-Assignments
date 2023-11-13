// Import necessary libraries and modules
import {Elysia} from "elysia";
import {appConfig} from "./config.ts";
import {getEventForm, postNewEvent, getAtomFeed, postIngestFeed} from "./routes";

// Create a new Elysia server instance
const app = new Elysia()
    .use(appConfig)
    .use(getEventForm)
    .use(postNewEvent)
    .use(getAtomFeed)
    .use(postIngestFeed)
    // Start the server on port 3000
    .listen(3000);

// Log a message when the server starts successfully
console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
