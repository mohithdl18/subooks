
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "suvilla_bookings";

if (!uri) {
  throw new Error("Please add MONGODB_URI to your .env.local file");
}

const options = {};

const globalMongo = globalThis;

let client;
let clientPromise;

if (!globalMongo._mongoClientPromise) {
  client = new MongoClient(uri, options);
  globalMongo._mongoClientPromise = client.connect();
}

clientPromise = globalMongo._mongoClientPromise;

// Collection definitions
const collectionDefinitions = [
  {
    name: "room_availabilty",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["date", "booked_rooms"],
        properties: {
          date: {
            bsonType: "string",
            pattern: "^\\d{4}-\\d{2}-\\d{2}$",
            description: "Date in YYYY-MM-DD format",
          },
          booked_rooms: {
            bsonType: "array",
            items: {
              bsonType: "string",
            },
          },
          blocked_rooms: {
            bsonType: "array",
            items: {
              bsonType: "string",
            },
          },
          temporary_holds: {
            bsonType: "array",
            items: {
              bsonType: "object",
              required: ["TempID", "roomId", "expiresAt"],
              properties: {
                TempID: { bsonType: "string" },
                roomId: { bsonType: "string" },
                expiresAt: { bsonType: "date" },
              },
            },
          },
        },
      },
    },
  },
  {
    name: "bookings_data",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "booking_id",
          "personal_info",
          "dinner",
          "driver",
          "terms_conditions",
          "paid_amount",
          "status",
        ],
        properties: {
          booking_id: { bsonType: "string" },
          personal_info: {
            bsonType: "object",
            required: [
              "name",
              "email",
              "phone_number",
              "aadhar_number",
              "address",
              "pin_code",
              "city",
              "special_request",
            ],
            properties: {
              name: { bsonType: "string" },
              email: { bsonType: "string" },
              phone_number: { bsonType: "string" },
              aadhar_number: { bsonType: "string" },
              address: { bsonType: "string" },
              pin_code: { bsonType: "string" },
              city: { bsonType: "string" },
              special_request: { bsonType: "string" },
            },
          },
          dinner: {
            bsonType: ["int", "long", "double"],
            minimum: 0,
          },
          driver: {
            bsonType: "object",
            required: ["accommodation", "dinner"],
            properties: {
              accommodation: { enum: ["yes", "no"] },
              dinner: { enum: ["yes", "no"] },
            },
          },
          terms_conditions: {
            enum: ["yes", "no"],
          },
          paid_amount: {
            bsonType: ["int", "long", "double", "decimal"],
            minimum: 0,
          },
          status: {
            bsonType: "string",
          },
        },
      },
    },
  },
  {
    name: "temp_books",
  },
];

// Create missing collections only.
async function ensureCollections(db) {
  const existingCollections = await db
    .listCollections({}, { nameOnly: true })
    .toArray();

  const existingNames = new Set(
    existingCollections.map((collection) => collection.name)
  );

  for (const definition of collectionDefinitions) {
    if (existingNames.has(definition.name)) {
      continue;
    }

    const collectionOptions = definition.validator
      ? { validator: definition.validator }
      : {};

    try {
      await db.createCollection(definition.name, collectionOptions);
    } catch (error) {
      // Another request may have created the collection concurrently.
      if (error.code !== 48) {
        throw error;
      }
    }
  }
}

// Get the database and ensure required collections exist.
export async function getDb() {
  const connectedClient = await clientPromise;
  const db = connectedClient.db(dbName);

  await ensureCollections(db);

  return db;
}

export { clientPromise };
