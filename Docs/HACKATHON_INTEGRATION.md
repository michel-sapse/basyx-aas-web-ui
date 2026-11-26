# Hackathon UI integration

`integration/hackathon-ui` combines features for shared testing and image builds.
It is not the source branch for an upstream feature PR.

## Included branches

- `feature/operation-result-table` (`ef7f3a7`): output rendering, temporary
  invocation results, search, filters, column selection and CSV export.
- `feat/readrecords-date-time-picker` (`baeb49a`): theme-aware, responsive
  ReadRecords date-time selection with fixed-height quick ranges, automatic
  updates and support for both Timespan Range and legacy start/end inputs.
- `query_favorites` (`2c5590a`): named advanced AAS-search query favorites,
  saved in browser localStorage with edit, run and delete controls.
- `feat/spatial-layout-preview` (`b0d6f0d`): spatial placement preview and
  coordinate editor; coordinates are persisted only through explicit Save.
- Base: `main` / upstream commit `91c429a`, including the dependency updates.

All four features are included. Query favorites are saved search definitions,
not bookmarks of individual assets.

The record table uses `Metadata.Record` for column order, names and types,
including columns absent from every returned record. Undeclared returned fields
are appended and labeled. Without usable metadata, it falls back to the union
of returned scalar fields. Each record remains separate; missing cells display
an em dash (empty in CSV). Metadata example values never become measurements.

## Integration decisions

The Operation renderer retains both the date-time argument controls and the
result renderer/store. Tests retain both component stub sets and Pinia setup.

The date-time picker expects canonical UTC milliseconds, while repositories can
return valid bounds without fractional seconds or with explicit offsets. The
integration-only `pickerTimestamp` adapter normalizes the picker view and
validation without rewriting stored/invocation values just by opening the view.
Valid changed selections are applied automatically; unchanged bounds retain
their original backend lexical representation. The payload test compares the
exact instants rather than requiring optional zero milliseconds in the string.
This compatibility behavior should be reviewed with the picker feature owner
before the separate upstream PR is finalized.

## Checks

From `aas-web-ui/`, use `pnpm install --frozen-lockfile` and `pnpm build`.
The `operation-results.pw.ts` integration test applies the date-time range,
asserts the invocation payload, and checks the result table controls and reload
behavior against the optional `examples/TimeSeriesData` operation overlay.

```shell
IT_DISABLE_WEBSERVER=true IT_TIMESERIES_URL=http://127.0.0.1:3002 pnpm exec playwright test --project=integration-timeseries tests/integration/plugins/operation-results.pw.ts
```

Use `IT_BROWSER_CHANNEL=chrome` for a locally installed Chrome if needed.
Local infrastructure config and generated WASM changes are not part of this
branch's commits. Build deployable images from a clean commit checkout/archive.
