import {Elysia, t} from "elysia";
import swagger from "@elysiajs/swagger";
import {ulid} from "ulidx";

const _: {
    domain: string,
    inbox: any[],
    outbox: any[],
} = {
    domain: 'https://example.org',
    inbox: [],
    outbox: [],
}

const app = new Elysia()
    .use(swagger())
    .post('v1/create-event', ({body, set}) => {
        const id = ulid();
        const activity = {
            "@context": "https://www.w3.org/ns/activitystreams",
            "type": "Create",
            "id":  `${_.domain}/${id}`,
            "actor": `${_.domain}/global`,
            "object": {
                "id":  `${_.domain}/${id}`,
                "type": "Event",
                "name": body.title,
                "content": body.content,
                "startDate": body.startDate,
                "endDate": body.endDate,
                "location": body.location,
                "attributedTo": `${_.domain}/global`,
                "published": new Date().toISOString(),
                "updated": new Date().toISOString(),
                "to": ["https://www.w3.org/ns/activitystreams#Public"],
                "accepted": [],
                "rejected": [],
            }
        };
        _.outbox.push(activity);
        return activity;
    }, {
        body: t.Object({
            title: t.String(),
            content: t.String(),
            startDate: t.String(),
            endDate: t.Optional(t.String()),
            location: t.String(),
        }),
    })
    .get("/", () => "Hello Elysia")
    .get(".well-known/webfinger", ({query: {resource}, set}) => {
        set.status = 'Not Implemented';
        return 'Not Implemented';
    }, {
        query: t.Object({
            resource: t.String(),
        }),
    })
    .listen(3000);

console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
