import {Prisma, PrismaClient} from "@prisma/client";
import {v4 as uuid} from "uuid";
import {inspect} from "bun";


const prisma = new PrismaClient({
    log: ['warn', 'error'],
    errorFormat: 'pretty',
});

const FEED_ID = process.env.FEED_ID ?? uuid();
const FEED_TITLE = process.env.FEED_TITLE ?? "Example Atom Feed";
const FEED_URL = process.env.FEED_URL ?? "/feed";

const feed = await prisma.feed.upsert({
    create: {
        id: FEED_ID,
        title: FEED_TITLE,
        link: FEED_URL,
    },
    update: {
        updatedAt: new Date(),
        title: FEED_TITLE,
        link: FEED_URL,
    },
    where: {
        id: FEED_ID
    }
});

console.log('Feed metadata', feed);

const cleanUp = async () => {
    return Promise.allSettled([
        prisma.feed.deleteMany({
            where: { id: {not: FEED_ID} }
        }),
        prisma.event.deleteMany({
            where: { OR: [{ feedId: {not: FEED_ID } }, { feedId: null }] }
        }),
        prisma.author.deleteMany({
            where: { OR: [{ feedId: {not: FEED_ID } }, { feedId: null }] }
        }),
    ]).catch(console.log);
};

console.log('Cleaning up');
console.log(await cleanUp());

const getAll = async () => {
    return Promise.allSettled([
        prisma.feed.findMany(),
        prisma.event.findMany(),
        prisma.author.findMany(),
        prisma.source.findMany(),
    ]);
}

console.log('Data')
console.log(inspect(await getAll()))

const getEvents = async () => {
    return prisma.event.findMany({
        include: {
            authors: true,
            source: true,
        },
        where: {
            feedId: feed.id,
        }
    });
}

type ReturnedEvents = Prisma.PromiseReturnType<typeof getEvents>;

const getMetadata = async () => {
    return await prisma.feed.findFirst({
        where: {
            id: FEED_ID
        }
    }).then(feed => ({
        id: feed!.id,
        lastUpdated: feed!.updatedAt,
        link: feed!.link,
    }))
}

type ReturnedMetadata = Prisma.PromiseReturnType<typeof getMetadata>;

const databaseFunctions = {
    getEvents,
    getMetadata,
    cleanUp,
    getAll,
}

export {prisma, feed, databaseFunctions};
export type {ReturnedEvents, ReturnedMetadata};
