---
title: how whimsee knows you're there
summary: a postgis distance check inside one database function, and a table that nobody is allowed to write to.
---

[whimsee](https://whimsee.co.uk) is an app for hiding a small note where you stand. someone else can only read it by walking to the same spot. that sentence is the whole product, and it lives or dies on one question: how does the server know you're actually there?

the short answer is that it doesn't trust the phone. it measures.

## what a note is, to the database

in the app the word is glimmer. in the database the table is called `treasures`, because the table came first. it stores latitude and longitude as plain numbers, and postgres derives a geography point from them as a generated column:

```sql
location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
) STORED,
```

geography rather than geometry matters. distances come back in metres on a spheroid, so every threshold in the system is a literal number of metres and there is no projection maths anywhere. a gist index sits on the column, so "what's near me" is cheap.

## the map shows you nothing

when the app draws nearby glimmers it calls one function, `get_treasures_nearby()`. it returns an id, a position, a distance, and whether you've already found it. it does not return the note and it does not return who left it. the mystery is enforced at the query, not in the interface.

## the gate

to open one, the phone calls `discover_treasure()` with three values: the glimmer id, your latitude, your longitude. inside, one line decides everything:

```sql
IF NOT ST_DWithin(
  v_treasure.location,
  ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography,
  15
) THEN
  RAISE EXCEPTION 'Not close enough yet — keep wandering';
END IF;
```

fifteen metres. the app itself celebrates at ten. the slack points outward on purpose. gps under tree cover drifts, and the failure i wanted to engineer out was standing on the thing while the server says no. every dig the phone offers is one the server will honour, and the extra five metres is the price.

## why you can't skip the gate

this is the part i'm proudest of, and it isn't clever code. it's the absence of a permission.

row level security on `treasures` says you can read a row if you created it, or if there's a row in `discoveries` saying you found it. and `discoveries` has no insert policy at all. no client can write to it. the only thing that can is `discover_treasure()`, which runs with elevated rights and only writes after the distance check passes.

so the content isn't hidden behind a check you could route around. the only way to get the key is to call the function that measures you.

## the honest limits

there is no anti-spoofing. no mock-location detection, no impossible-travel check. gps accuracy never leaves the phone. it's used for the feel of the hunt, where fixes worse than 35 metres are ignored, until an app review ipad with no gps chip taught me to relax that after eight seconds. the server never sees it. if you fake your position to read a stranger's note, you've spent real effort defeating the point of a free app about going outside. that's the bet.

offline is the interesting tension. you can pack a five-kilometre bundle onto your phone for dead zones, which means the content travels with you. it's checked locally at fifteen metres and rechecked on replay at twenty-five. i know that weakens the guarantee. children's bundles are family-only for exactly that reason.

## the bit i didn't expect

row level security filters rows, not columns. a security review in july found that the table for permanent spots had a permissive select policy, so anyone with the public key could read a spot's hidden description and exact pin straight from the table, skipping the visit gate entirely. glimmers were never exposed that way because they were never served from their table. the fix was to revoke select on spots and route everything through the same kind of function.

the lesson generalises. don't serve the secret table at all.

## the one thing that leaves the phone

for analytics, the only location signal that ever leaves the device is a precision-five geohash, a cell about five kilometres across. glimmer content and exact coordinates never do.
