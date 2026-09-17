---
title: How Whimsee Knows You're There
summary: A PostGIS distance check, a five-metre server margin, and a table ordinary clients cannot write to.
category: build
---

[Whimsee](https://whimsee.co.uk) is an app for hiding a small note where you stand. Someone else can only read it by walking to the same spot. That's the whole product, and it lives or dies on one question: how does the server know you're there?

It doesn't trust the phone's answer. It takes the coordinates the phone supplies and calculates the distance again.

That isn't the same as proving the phone is physically there. Whimsee has no anti-spoofing. But it does mean the app cannot simply announce that a note has been found and expect the server to agree.

## What a glimmer is, to the database

In the app the word is glimmer. In the database the table is called `treasures`, because the table came first. It stores latitude and longitude as plain numbers, and Postgres derives a geography point from them:

```sql
location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
) STORED,
```

`geography`, not `geometry`. For geography values, [`ST_DWithin`](https://postgis.net/docs/ST_DWithin.html) takes its distance in metres and uses spheroidal measurement by default. PostGIS handles the geodesic maths rather than leaving it in the application.

A GiST index sits on the generated column. The proximity query is not free, but PostGIS can use the index to narrow the search before performing the exact distance check.

## The nearby query returns no note

When the app draws nearby glimmers it calls `get_treasures_nearby()`. The function returns an ID, a position, a distance, and whether you've already found it.

It does not return the note or who left it. That keeps the content out of this query path. The database permissions still have to prevent somebody from going around the function and reading the table directly.

## The distance check

To open a glimmer, the phone calls `discover_treasure()` with three values: the glimmer ID, latitude, and longitude. Inside, this is the check that matters:

```sql
IF NOT ST_DWithin(
  v_treasure.location,
  ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography,
  15
) THEN
  RAISE EXCEPTION 'Not close enough yet, keep wandering';
END IF;
```

The server accepts the find within fifteen metres. The app celebrates at ten.

The five-metre margin is deliberate. GPS can drift between the phone showing the button and the server checking the request, especially under tree cover. The margin reduces the chance of somebody standing on the glimmer and being refused because the next fix moved.

## Why the app can't skip that check

The important part here is a permission the client does not have.

Row-level security on `treasures` lets you read a row if you created it or if a row in `discoveries` says you found it. Row-level security is also enabled on `discoveries`, with no insert policy for the ordinary client role. Under Postgres's [default-deny behaviour](https://www.postgresql.org/docs/current/ddl-rowsecurity.html), the client cannot award itself a discovery.

The intended write path is `discover_treasure()`. It runs with elevated rights, performs the distance check, and only then inserts the discovery row.

That makes the gate harder to route around than a check in the interface. It also puts a lot of responsibility in one privileged database function. Elevated functions need the usual protections: a trusted `search_path`, narrow execute permissions, and validation before any write.

## The honest limits

The server measures the coordinates it receives. It does not prove where those coordinates came from.

There is no mock-location detection and no impossible-travel check. GPS accuracy never reaches the server. On the phone, fixes worse than 35 metres are ignored during the hunt. App Review gets a demo mode because its device could not produce a fix inside that guard.

Someone prepared to fake their location can beat this. That is a limit I've accepted for a free app about going outside, not a property the database has somehow solved.

Offline play weakens the guarantee further. You can load a five-kilometre bundle onto the phone for dead zones, which means the content is already on the device. The app checks a find locally at fifteen metres, then the server accepts its later sync within twenty-five. A determined person controlling the client could inspect the bundle or bypass the local check. Children's bundles are family-only to limit that exposure.

## The route around a different gate

Row-level security filters rows, not columns.

A security review in July found that the table for permanent spots had a permissive select policy. Anyone using the public client key could read a spot's hidden description and exact pin directly from the table, without making the gated visit.

Glimmers were not exposed in the same way, but only because their content had never been served directly from the table. The fix for spots was to revoke direct select access and route reads through a function that returns only the fields the caller is allowed to see.

The nearby function withholding a note was useful. It was not, by itself, a security boundary.

## What analytics receives

Analytics gets a five-character geohash, roughly a 4.9 by 3 kilometre cell at the latitude of the Forest of Dean. That is coarse location information, not anonymous or location-free data.

Precise coordinates necessarily go to Whimsee's server when it performs the distance check, and glimmer coordinates are stored as part of the product. They do not go to PostHog. Neither does the glimmer's content.

So the server can establish that the coordinates it was given are close enough to the glimmer. It cannot establish that the device, or the person holding it, was really there. For Whimsee, that is the line I chose.
