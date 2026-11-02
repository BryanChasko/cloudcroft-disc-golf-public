# hackathon alignment: Weekend Challenge Map it

living checklist tying this repo to the contest rules and judging criteria.
update as items land. same format as our re:invent planner entry.

## dates

| milestone                                 | date                    | status      |
| ----------------------------------------- | ----------------------- | ----------- |
| prep day                                  | 2026-10-29              | in progress |
| challenge opens                           | 2026-10-30 12:00 AM PDT | pending     |
| challenge closes                          | 2026-11-02 1:00 PM PST  | pending     |
| gate 1: AI scoring + human review, top 50 | after close             | pending     |
| gate 2: judge review, 5 winners           | after gate 1            | pending     |

## submission requirements

| requirement                                                      | state                                                                                                      | owner   |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------- |
| previously unpublished project                                   | yes, new repo                                                                                              | done    |
| dataset described: what is in it                                 | dataset/sources.md + readme                                                                                | open    |
| how it got on the map: location/data service + why               | docs/build-log.md, how-this-works page                                                                     | open    |
| at least one AWS service in app or pipeline                      | location service + s3 + lambda                                                                             | open    |
| link to live map, or running demo in video                       | https://bryanchasko.com/cloudcroft-disc-golf/app/ live + verified                                          | done    |
| public code repo (optional, encouraged)                          | private by choice, IP stays closed. mitigation: public how-it-works writeup documents the reusable pattern | decided |
| demo field: public video under 3 minutes, live map + exploration | record last                                                                                                | open    |

## judging criteria and evidence (25% each)

| criterion                            | evidence we have or need                                                                                                                                                     |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| technical innovation and originality | plays-like distance from 3DEP elevation fused with ground-truth tee/basket GPS; per-hole geofences triggering AR overlays; 360-pano VR walkthrough of a real mountain course |
| craft and execution                  | live map opens fast, click/zoom/filter per hole; geofence arrival + distance-to-pin verified on site; rust ARM lambdas, tested backend                                       |
| usefulness and impact                | scorecard + virtual walkthrough reusable pattern for any small course; dataset + pipeline documented so others can map theirs; bryanchasko.com page for remote visitors      |
| creativity and storytelling          | Ray Haller course history, tiki putting-course character, elevation story at 8,676 ft; build log as narrative; under-3-min demo video                                        |

## open work, in order

- ground-truth GPS: every tee + basket on both courses (boots on ground)
- 360 panos at each tiki tee + basket look-back; pixel photos of signs/hazards/trail crossings
- finalize GeoJSON dataset with plays-like distances
- ship rust lambda backend (distance calc, scorecard API)
- ship live 2D map on Amazon Location Service tiles
- ship virtual walkthrough with VR toggle
- android ARCore companion if time allows
- record demo video, write submission, submit with margin (aim Nov 1)

## story for the writeup

a real mountain town, two real courses, one local legend. Ray Haller built both
courses by hand; the tiki course is all putters under aspen and doug fir. the
dataset is measured on foot at 8,676 ft, the elevation math comes from USGS
3DEP, and anyone can walk the course from their browser or stand on the tee pad
and see the line to the pin through their phone.
