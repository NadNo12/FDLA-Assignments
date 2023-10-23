import {ReturnedEvents, ReturnedMetadata} from "../main.ts";
import * as prettier from 'prettier';

export default async ({events, metadata}: { events: ReturnedEvents, metadata: ReturnedMetadata }) =>
    await prettier.format(`<?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Events feed</title>
        <id>urn:uuid:${metadata.id}</id>
        <updated>${metadata.lastUpdated.toISOString()}</updated>
        <link rel="self" href="${metadata.link}" />

        ${events.map((event) => `<entry>
                <title>${event.title}</title>
                <id>${event.id.startsWith("urn:") ? '' : 'urn:uuid:'}${event.id}</id>
                <content type="text">${event.content}</content>
                <published>${event.createdAt.toISOString()}</published>
                <updated>${event.updatedAt.toISOString()}</updated>
                ${event.authors.map((author) =>  `<author>
                        <name>${author.name}</name>
                    </author>`).join('')}
                ${event.source ? `<source>
                    <id>${event.source.id}</id>    
                    <title>${event.source.title}</title>
                    <updated>${event.source.updatedAt.toISOString()}</updated>
                </source>` : ''}
            </entry>`).join('')}
    </feed>`, {
        plugins: ["@prettier/plugin-xml"],
        parser: "xml",
        printWidth: 120,
        xmlWhitespaceSensitivity: "ignore"
    } as any)

