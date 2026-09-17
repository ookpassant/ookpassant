---
title: How Whimsee knows you're there
summary: A PostGIS distance check, a five-metre server margin, and a table ordinary clients cannot write to.
category: build
---

[whimsee](https://whimsee.co.uk) is an app for hiding a small note where you stand. someone else can only read it by walking to the same spot. that's the whole product, and it lives or dies on one question: how does the server know you're there?

it doesn't trust the phone's answer. it takes the coordinates the phone supplies and calculates the distance again.

that isn't the same as proving the phone is physically there. whimsee has no anti-spoofing. but it does mean the app cannot simply announce that a note has been found and expect the server to agree.

## what a glimmer is, to the database

in the app the word is glimmer. in the database the table is called `treasures`, because the table came first. it stores latitude and longitude as plain numbers, and postgres derives a geography point from them:

```sql
location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
) STORED,
```

`geography`, not `geometry`. for geography values, [`ST_DWithin`](https://postgis.net/docs/ST_DWithin.html) takes its distance in metres and uses spheroidal measurement by default. postgis handles the geodesic maths rather than leaving it in the application.

a gist index sits on the generated column. the proximity query is not free, but postgis can use the index to narrow the search before performing the exact distance check.

## the nearby query returns no note

when the app draws nearby glimmers it calls `get_treasures_nearby()`. the function returns an id, a position, a distance, and whether you've already found it.

it does not return the note or who left it. that keeps the content out of this query path. the database permissions still have to prevent somebody from going around the function and reading the table directly.

## the distance check

to open a glimmer, the phone calls `discover_treasure()` with three values: the glimmer id, latitude, and longitude. inside, this is the check that matters:

```sql
IF NOT ST_DWithin(
  v_treasure.location,
  ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography,
  15
) THEN
  RAISE EXCEPTION 'Not close enough yet, keep wandering';
END IF;
```

the server accepts the find within fifteen metres. the app celebrates at ten.

the five-metre margin is deliberate. gps can drift between the phone showing the button and the server checking the request, especially under tree cover. the margin reduces the chance of somebody standing on the glimmer and being refused because the next fix moved.

## why the app can't skip that check

the important part here is a permission the client does not have.

row-level security on `treasures` lets you read a row if you created it or if a row in `discoveries` says you found it. row-level security is also enabled on `discoveries`, with no insert policy for the ordinary client role. under postgres's [default-deny behaviour](https://www.postgresql.org/docs/current/ddl-rowsecurity.html), the client cannot award itself a discovery.

the intended write path is `discover_treasure()`. it runs with elevated rights, performs the distance check, and only then inserts the discovery row.

that makes the gate harder to route around than a check in the interface. it also puts a lot of responsibility in one privileged database function. elevated functions need the usual protections: a trusted `search_path`, narrow execute permissions, and validation before any write.

## the honest limits

the server measures the coordinates it receives. it does not prove where those coordinates came from.

there is no mock-location detection and no impossible-travel check. gps accuracy never reaches the server. on the phone, fixes worse than 35 metres are ignored during the hunt. app review gets a demo mode because its device could not produce a fix inside that guard.

someone prepared to fake their location can beat this. that is a limit I've accepted for a free app about going outside, not a property the database has somehow solved.

offline play weakens the guarantee further. you can load a five-kilometre bundle onto the phone for dead zones, which means the content is already on the device. the app checks a find locally at fifteen metres, then the server accepts its later sync within twenty-five. a determined person controlling the client could inspect the bundle or bypass the local check. children's bundles are family-only to limit that exposure.

## the route around a different gate

row-level security filters rows, not columns.

a security review in july found that the table for permanent spots had a permissive select policy. anyone using the public client key could read a spot's hidden description and exact pin directly from the table, without making the gated visit.

glimmers were not exposed in the same way, but only because their content had never been served directly from the table. the fix for spots was to revoke direct select access and route reads through a function that returns only the fields the caller is allowed to see.

the nearby function withholding a note was useful. it was not, by itself, a security boundary.

## what analytics receives

analytics gets a five-character geohash, roughly a 4.9 by 3 kilometre cell at the latitude of the Forest of Dean. that is coarse location information, not anonymous or location-free data.

precise coordinates necessarily go to whimsee's server when it performs the distance check, and glimmer coordinates are stored as part of the product. they do not go to posthog. neither does the glimmer's content.

so the server can establish that the coordinates it was given are close enough to the glimmer. it cannot establish that the device, or the person holding it, was really there. for whimsee, that is the line I chose.
