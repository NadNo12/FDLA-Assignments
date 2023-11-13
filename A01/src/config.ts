import {Elysia} from "elysia";
import {swagger} from "@elysiajs/swagger";
import {databaseFunctions, prisma} from "./database.ts";

const errorLog = Bun.file("./error.log");
const errorWriter = errorLog.writer();
errorWriter.unref();

export const appConfig = new Elysia()
    .use(swagger({
        path: '/swagger',
        documentation: {
            info: {
                title: 'Nadjim & Kai\'s Atom Feed Documentation',
                version: '1.0.0'
            },
        }
    }))
    .onError(({ code, error, set }) => {
        errorWriter.write(error.toString() + '\n');
        errorWriter.flush();

        set.status = 400;
        return error.toString();
    })
    .state('prisma', prisma)
    .state('databaseFunctions', databaseFunctions);

