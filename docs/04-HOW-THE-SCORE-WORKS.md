# How the score works

The same rules run in the app (`app/engine.js`) and the command line tool (`tools/visibility.py`). The tests check that both give
exactly the same numbers on the sample (`tests/engine.test.mjs`, `tests/test_visibility.py`).

## Points

| Weight | Points |
| --- | --- |
| High | 3 |
| Medium | 2 |
| Low | 1 |

## Answers

| Answer | Points earned | Counted in points possible? |
| --- | --- | --- |
| Yes | all its points | yes |
| No | 0 | yes |
| Not sure | 0 | yes |
| Not answered | 0 | yes |
| Not relevant | 0 | no, it is left out |

## The visibility score

```
visibility score = points earned / points possible x 100
```

It is shown as a whole percent, rounded half up (53.75 shows as 54). If every item is Not relevant, there is no score.

## Status

| Status | When |
| --- | --- |
| Green | 70 percent or more |
| Amber | 40 percent or more, below 70 |
| Red | below 40 percent |

The status uses the exact share, not the rounded one. So 69.5 percent shows as 70 but stays amber until it really reaches 70.
Each section gets its own score and status with the same rules.

## Top fixes

Every item that is not Yes and not Not relevant is a fix. They are ordered by:

1. points, biggest first;
2. then No before Not sure before Not answered;
3. then the order of the checklist.

The app shows the top 5. Claude explains the top 3.

## The tracker numbers

- **Share of answers** for a date = answers that named you / all answers you recorded that date x 100, rounded half up.
- **Change since first check** = the latest date's share minus the first date's share, in percentage points.
- **By platform** = the same share, per platform, for the latest date.
- **Average position** = the average of the positions you recorded when you were named, latest date, rounded to one decimal.
- **Who gets named most** = how many recorded answers named each competitor, across all dates. Names are matched without caring
  about capital letters or extra spaces.

## Worked example (the fictional sample)

43 points earned out of 80 possible (one low item is Not relevant) = 53.75 percent, shown as 54 percent, amber. The tracker has
12 prompts on 5 platforms on 3 dates: 7 of 60, 16 of 60 and 25 of 60 answers named the business, so the share went from 12 to 27 to
42 percent, a change of +30 points. All numbers in the sample are made up.
