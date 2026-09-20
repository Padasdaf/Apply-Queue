import { z } from "zod/v4";

/** PostgreSQL timestamptz serialized by PostgREST, including explicit UTC offsets. */
export const postgresTimestampSchema = z.iso.datetime({ offset: true });
