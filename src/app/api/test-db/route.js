
import { getDb, clientPromise } from "@/lib/mongodb";

export async function GET() {
  try {
    const db = await getDb();

    // Verify that MongoDB responds to a ping.
    await db.command({ ping: 1 });

    // Check the collections configured for this project.
    const collections = await db
      .listCollections({}, { nameOnly: true })
      .toArray();

    return Response.json({
      success: true,
      message: "MongoDB connected successfully!",
      database: db.databaseName,
      collections: collections.map((collection) => collection.name),
    });
  } catch (error) {
    console.error("MongoDB connection test failed:", error);

    return Response.json(
      {
        success: false,
        message: "MongoDB connection failed.",
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : "Check your MongoDB configuration and server logs.",
      },
      { status: 500 }
    );
  }
}
