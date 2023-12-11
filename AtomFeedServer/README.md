# Event Feed

## URLs

Self referencing link to this project: https://github.com/NadNo12/FDLA-Assignments/tree/master/A01

To access the Swagger documentation of the running application: http://localhost:3000/swagger 

## Description

### A01 - Basic centralized event publishing system 

This is our solution for the first assignment, containing three routes. The first route is serving the event form an displays existing events using the GET method. The second route adds a new event when using the POST method. The third route renders the events as an ATOM feed. 

The application is using the Bun JavaScript runtime due to its integrated SQLite functionality, as well as the ElysiaJS web framework, and EtaJS for template rendering. For CSS purposes Water.CSS is used and referenced. 

### A02 - Decentralization of centralized system, first step

We chose to document our application using Swagger, a toolkit for developing API interfaces, with OpenAPI, which is a specification language for API documentation.

To accomplish this we added a Swagger plugin to our ElysiaJS application, and documented our existing routes.

Afterwards, we added a new route, to ingest an existing atom feed, which checks if there are any events in the feed, and adds new events to the database.

## Authors

- Nadjim Noori <nnoori2@smail.uni-koeln.de>
- Kai Niebes <kniebes@smail.uni-koeln.de>
