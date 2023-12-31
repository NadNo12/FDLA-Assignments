import type {ReturnedEvents} from "../database.ts";

export default async ({events, success}: {events: ReturnedEvents, success: boolean}) =>
    `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Event Form</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/water.css@2/out/water.css">
        <style>
            form {
                display: flex;
                flex-direction: column;
                align-items: stretch;
            }
    
            form * {
                box-sizing: border-box;
            }
    
            div.event {
                padding: 0px 16px;
                border: solid 2px rgba(0,0,0,0.5);
                border-radius: 12px;
            }
    
            div.event + div.event {
                margin-top: 12px;
            }
        </style>
    </head>
    <body>
        <h1>Submit a new event</h1>
        
        ${success ? '<h2>Event was added</h2>' : ''}
        
        <form action="/" method="post">
            <label for="name">Your name</label>
            <input type="text" name="name" id="name" required>
    
            <label for="title">Event title</label>
            <input type="text" name="title" id="title" required>
            
            <label for="date">Date</label>
            <input type="datetime-local" name="date" id="date" required>
            
            <label for="description">Description</label>
            <textarea name="description" id="description" required></textarea>
            
            <button type="submit">Add event</button>
        </form>
    
        <h1>Existing events</h1>
        ${events.map(event => 
            `<div class="event">
                <h3>${event.title}</h3>
                <p>
                    ${event.summary ?? event.description}
                </p>
                <small>${event.authors.map(author => author.name).join(', ')}</small>
            </div>`
        ).join('')}

    </body>
    </html>`
