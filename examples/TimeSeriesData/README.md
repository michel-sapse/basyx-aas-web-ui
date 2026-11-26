# Time Series Data plugin example

This example starts a complete local environment for exploring the AAS Web UI's Time Series Data plugin. It demonstrates three common ways to provide time-series data:

- **InternalSegment**: archived values stored directly in the AAS
- **ExternalSegment**: archived values stored in a CSV attachment
- **LinkedSegment**: continuously generated values queried from InfluxDB

Use the example to compare the segment types, try relative and absolute time ranges, reuse Flux queries from InfluxDB or Grafana, enable automatic refresh, and inspect the available visualizations.

## What the example starts

| Service | Purpose |
| --- | --- |
| AAS Web UI | Displays the example AAS and the Time Series Data plugin |
| BaSyx Go AAS Environment | Serves the preconfigured `SensorExampleAAS` and its submodel |
| BaSyx Go Configuration Service | Initializes the PostgreSQL schema before the AAS Environment starts |
| PostgreSQL | Stores the BaSyx environment data |
| MQTT publisher and Mosquitto | Generate and transport new sensor and machine values every second |
| Telegraf | Writes the MQTT values to InfluxDB |
| InfluxDB 2.7 | Stores the live LinkedSegment data |

The included [`TimeSeriesDemo.aasx`](aas/TimeSeriesDemo.aasx) is loaded automatically when the environment starts.

## Quick start

### Prerequisites

- Docker with Docker Compose v2

This stack is intended for local demonstration only. It uses fixed demo credentials, a preconfigured InfluxDB administration token, and published host ports. Do not expose it to an untrusted network.

From the repository root, run:

```shell
cd examples/TimeSeriesData
docker compose up -d
docker compose ps
```

The first start can take a few minutes while Docker downloads the images and the services initialize. Wait until `timeseries-aas-env`, `timeseries-postgres`, and `mosquitto` are healthy. The `timeseries-basyx-configuration` container is expected to finish with exit code `0`; it performs a one-time initialization task.

Open the following services:

| Service | URL | Credentials |
| --- | --- | --- |
| AAS Web UI | http://localhost:3000 | None |
| InfluxDB | http://localhost:8086 | `admin` / `influxpassword` |
| AAS Environment API | http://localhost:8081 | None |

## Explore the plugin

Start with these common navigation steps:

1. Open the AAS Web UI at http://localhost:3000.
2. Select `SensorExampleAAS`.
3. Select the `TimeSeries` submodel in the tree.
4. Open the **Visualization** tab.

The **Preview Configuration** card lets you select a segment, a timestamp property, one or more value properties, a time range, and an optional refresh interval. Press **Fetch Data** to load the selected data immediately.

### InternalSegment

Use this segment to inspect data stored directly in the AAS:

1. Select `InternalSegment` as the segment.
2. Select `time` as the time value.
3. Select `Temperature` as the y-value.
4. Select a time range and press **Fetch Data**.
5. Select a chart type in **Preview Chart**.

Relative ranges are anchored to the newest timestamp in the stored records, so the archived example remains usable even when its timestamps are older than the current time.

### ExternalSegment

Use this segment to inspect data from the CSV attachment referenced by the AAS:

1. Select `ExternalSegment` as the segment.
2. Select `time` as the time value.
3. Select `Temperature` as the y-value.
4. Select a time range and press **Fetch Data**.
5. Select a chart type in **Preview Chart**.

As with InternalSegment, relative ranges are anchored to the newest valid timestamp in the returned file.

### LinkedSegment

Use this segment to query the live machine data stored in InfluxDB:

1. Select `LinkedSegment` as the segment.
2. Select `time` as the time value.
3. Select `pressure`, `rpm`, or `vibration` as a y-value.
4. Select a recent relative range such as **Last 5m**.
5. Press **Fetch Data** and select a chart type.

The Web UI container receives the example token through `INFLUXDB_TOKEN`, so an API-token field normally does not appear. If it does appear, use the token configured in [`docker-compose.yaml`](docker-compose.yaml).

The example's [`basyx-infra.yml`](basyx-infra.yml) includes `http://localhost:8086` in `trustedOrigins` so the Web UI can query InfluxDB. If you change the InfluxDB host or port, update this origin along with the LinkedSegment endpoint.

The MQTT publisher creates a new machine-data sample every second. If the first query is empty immediately after startup, wait a few seconds and fetch again.

## Time ranges and Flux variables

The selected range controls both the query and every visualization:

- LinkedSegment relative ranges end at the current time.
- InternalSegment and ExternalSegment relative ranges end at the newest available sample.
- Absolute ranges use the entered local start and end times and are converted to UTC for the query.

Flux queries copied from the InfluxDB query editor or a Grafana Flux panel can use the variables supplied by the plugin:

| Variable | Supplied value |
| --- | --- |
| `v.timeRangeStart` | Selected UTC range start |
| `v.timeRangeStop` | Selected UTC range end |
| `v.windowPeriod` | A duration calculated for approximately 360 points |

For example:

```flux
from(bucket: "basyx")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "machine_metric")
  |> filter(fn: (r) => r["_field"] == "{{y-value}}")
  |> aggregateWindow(every: v.windowPeriod, fn: mean, createEmpty: false)
```

`{{y-value}}` is replaced with the first y-value selected in the plugin. Other `v.*` references must be defined by the query itself. Queries with hard-coded `range()` calls are sent unchanged.

## Auto refresh

Auto refresh is disabled by default. Open the adjacent **Auto Refresh** menu to enable it and select an interval in seconds, minutes, or hours.

- Press **Fetch Data** once when you want an immediate result; automatic updates occur after the selected interval.
- A refresh tick is skipped while an earlier request is still running.
- Relative LinkedSegment windows advance with incoming data.
- Absolute ranges retain their exact bounds.
- A manual chart zoom is preserved across refreshes.
- Fetching a changed time range resets the chart viewport.

## Visualizations

The plugin provides:

- Line Chart
- Area Chart
- Scatter Chart
- Histogram
- Gauge
- Display Field

Line, Area, and Scatter charts support x-axis selection, zoom in/out, pan, and reset from the chart toolbar. Hovered values include their configured units. Scrolling the page while the pointer is over a chart does not zoom it.

Gauge values, labels, and units remain visible without hovering. Selecting multiple y-values creates separate responsive gauges. Display Field shows the newest value and formats numeric values with two decimal places.

## Optional delegated time-series operation

For developing the operation dialog, add the optional overlay:

```shell
docker compose -f docker-compose.yaml -f docker-compose.operations.yaml up -d --build timeseries-operation-init
```

This keeps the original AASX unchanged and adds `GetTimeSeries` and `ReadRecords` to the existing
TimeSeries submodel using the repository API. Initialization does not overwrite
an existing operation. The AAS Environment delegates invocation to a small
TypeScript HTTP service; the browser still calls the normal AAS API.
The overlay uses an additional network (`172.29.0.0/24`) and allowlists only the
delegated service name and its fixed IP. If this subnet conflicts with another
network, change the subnet, service IP and delegation allowlist together.

Use the locally developed UI on port 3000, connected to the AAS Environment on
port 8081, rather than starting the example's published UI image.
Open `SensorExampleAAS → TimeSeries → GetTimeSeries`.

The fixture contains 25 temperature samples at five-minute intervals from
`2026-11-24T09:00:00Z` through `2026-11-24T11:00:00Z`. The first three values
are `20.5`, `21.0` and `21.5 °C`.
`Timespan` is a `Range<xs:dateTime>`. Both bounds are required and inclusive;
equal bounds are allowed, reversed bounds are rejected. Bounds require `Z` or
an explicit offset. Initial years 0001 and 9999 cover all fixture samples;
they are values, not picker limits. A range outside the fixture returns an
empty `Samples` list. Set `SimulateError` to true for a reproducible failure.

Outputs are full-metadata AAS OperationVariables: `Samples` is a
SubmodelElementList of SubmodelElementCollections containing `Timestamp`,
`Temperature` and `Unit` properties. This is a demo response contract, not a
claim of compliance with the complete IDTA time-series segment model.
Results belong to the invocation and are not written back into the submodel.
The unmodified UI may only show a summary for the Range and the result list;
the example provides a reproducible backend for improving those renderers.

`ReadRecords` uses two editable `Property<xs:dateTime>` arguments (`StartTime`
and `EndTime`) instead of a Range, so it can be tested independently of changes
to the Range input. Both are prefilled with the full 09:00–11:00 UTC fixture
interval, returning 25 rows. With 10 items per page, the pages contain 10, 10,
and 5 records. Initialization upgrades the previous untouched 09:00–09:10
ReadRecords fixture to this interval; customized definitions are left unchanged.
Its semantic
ID is `https://admin-shell.io/idta/TimeSeries/ReadRecords/1/1`; the delegation
target is local, never the production service. The output is a `Records`
SubmodelElementCollection with named `Record1`, `Record2`, ... collections,
each containing `time` (`xs:dateTime`) and `Temperature` (`xs:integer`), matching
these two fields in the example's `Metadata.Record`. Temperature samples are
20 through 44; their semantic ID references the existing ConceptDescription.
All seven metadata fields are populated with synthetic values: `time`,
`Temperature`, `Humidity`, `AirQuality`, `rpm`, `pressure` and `vibration`.
Humidity starts at 45 (+1 per sample), AirQuality at 420 (+15), rpm at 1200
(+50), pressure at 1013 (+1) and vibration at 2 (+1). These are display fixtures, not
real sensor readings. The supplied example incorrectly reuses the Temperature
ConceptDescription for rpm, pressure and vibration. Their headers consequently
show °C; correct those semantic references before using the model operationally.
No synthetic `Unit` property
is added to this operation. The exact inner layout
is demo data and must be checked against a real service response before claiming
compatibility with a production backend. The smoke check also verifies that
invoking `ReadRecords` leaves its persisted output definition unchanged.

In the developed UI, the operation dialog displays nested output values in a
paginated read-only table. Selecting `Records` in the tree also displays the
last invocation result, explicitly labeled as temporary. Returning to the
operation restores that result. The tree and JSON representation still refer
to the stored definition; no result values are saved to the backend. Browser
reload, switching infrastructures, or starting another invocation clears the
temporary result. The `clear` action clears it as well.

Collections of scalar records are displayed as one record per row and one
Property per column, preserving lexical values. Sparse records with different
metrics use the union of all fields across the entire result, not just the first
record or current page. Missing cells show an em dash and export as empty CSV
cells; values are never aggregated, interpolated or carried forward. Conflicting
types/semantic IDs, duplicate field names or nested structures retain the generic
element/value table. The operation result renderer reads `Metadata.Record` from the owning
submodel and resolves ConceptDescriptions once per column to show available
units. It does not infer a unit when a returned field has a different valueType
or conflicting semantic ID. Missing metadata leaves the values visible and
shows a notice. Metadata lookup currently expects `Metadata` and accepts either
the Record semantic ID or `Record` as the metadata collection name.

### Record table controls

- Search covers all loaded rows and columns, including hidden columns, without
  case sensitivity. It is combined with the applied filters.
- Filter conditions are combined with AND and take effect on **Apply filters**.
  Numbers and date-times use typed comparisons; time filters require a timezone.
- **Columns** selects the visible columns; at least one stays visible. These
  settings are temporary and reset when the table is recreated or its schema changes.
- Column headers support sorting (including keyboard Enter). Numeric values are
  right-aligned, units appear below the name and types appear below the table.
  Timestamp strings are preserved; the first date-time column is initially sorted ascending.
- **Export CSV** offers all loaded rows, filtered rows or the current page, with
  visible or all columns and optional headers. Exports follow the current sort,
  use comma-separated UTF-8 with BOM and CRLF, and quote cell contents. Text that
  could be interpreted as a spreadsheet formula is prefixed with an apostrophe.
- Search, filter and sort changes reset pagination to the first page. The title
  badge counts all loaded records; the footer counts the matching rows.

Check the service and actual synchronous/asynchronous AAS invocation with Node 24:

```shell
node --test operation-service/server.test.ts
node operation-service/smoke.ts
```

The UI repository includes `tests/integration/plugins/operation-results.pw.ts`
for the complete operation flow, pagination (10/10/5), tree navigation and
clearing results after reload. With the overlay and local UI running, execute
from `aas-web-ui/`:

```shell
IT_DISABLE_WEBSERVER=true pnpm exec playwright test --project=integration-timeseries tests/integration/plugins/operation-results.pw.ts
```

Install the Playwright Chromium browser first, or use `IT_BROWSER_CHANNEL=chrome`
to test with an installed Chrome. CI runs the service tests and API smoke check
and uses the operation overlay with a UI image built from the current PR.

When managing this optional stack, continue passing both Compose files (also
for `stop` or `down`). The service intentionally exposes no host port and
requires no dependencies beyond Node. Demo data is separate from InfluxDB.

## Stop or reset the example

Stop the running containers without removing them:

```shell
docker compose stop
```

Remove the containers and network:

```shell
docker compose down
```

PostgreSQL data is stored in its service container and is recreated after `docker compose down`. InfluxDB uses the bind-mounted `influxdb/data` and `influxdb/config` directories. To completely reset InfluxDB, bring the stack down and delete those generated directories before starting it again.

## Troubleshooting

### A Docker image download fails

Transient registry or network failures can produce messages such as `failed to copy`, `EOF`, or CloudFront download errors. Retry the pull and start:

```shell
docker compose pull
docker compose up -d
```

### A service does not become ready

Check its status and logs:

```shell
docker compose ps
docker compose logs --tail=100 aas-env
```

Replace `aas-env` with another service when needed. Useful service names include `influxdb`, `telegraf`, `mosquitto`, and `mqtt-publisher`.

### LinkedSegment returns no data

- Wait a few seconds after startup so the publisher and Telegraf can create samples.
- Use a recent relative range such as **Last 5m**.
- Confirm that `influxdb`, `telegraf`, `mosquitto`, and `mqtt-publisher` are running.
- Inspect the Telegraf and publisher logs for connection errors.

### A published port is already in use

Stop the conflicting local service or change the host-side port in `docker-compose.yaml`. The example publishes ports `3000`, `8081`, `8086`, `9999`, and `1883`.

## Scope

- LinkedSegment database access is implemented for Flux queries against InfluxDB.
- ExternalSegment is demonstrated with a CSV file containing a header row.
- The AAS follows the IDTA [Time Series Data submodel template](https://industrialdigitaltwin.org/wp-content/uploads/2023/03/IDTA-02008-1-1_Submodel_TimeSeriesData.pdf).
