# Spatial layout preview and coordinate correction

## Purpose

Help users recognize incorrect rack/server placement, adjust the selected asset in a spatial preview, and explicitly save corrected coordinates to the authoritative AAS data.

The motivating example is an asset at `z=22` whose correct position is `z=20`. The viewer must make that two-unit displacement recognizable against a known rack or other spatial reference. It must preserve x, y, orientation, and unrelated data when only z is changed. Units and axis directions come from the actual dataset.

## Current phase and working constraints

- Start with assessment and read-only investigation. Application implementation begins when the user explicitly requests it; that request advances the phase without another routine confirmation.
- During assessment, do not change application code or AAS data, run builds, update containers, commit, or push. User-requested documentation is allowed.
- Follow the applicable `AGENTS.md` files. Use Vue 3, TypeScript, Vuetify, Pinia, Vite, and existing Three.js dependencies and component patterns.
- Keep branch changes, commits, pushes, UI builds, and container updates under the user's control. Provide commands when requested.
- Keep this work separate from the ReadRecords date picker. Its auto-save behavior does not apply here: spatial movement is a draft until Save.

## Verified starting points

The initial inspection on 2026-11-26 established:

- `aas-web-ui/src/components/Plugins/CADPreview.vue` creates a Three.js scene, loads glTF/OBJ/STL files, provides camera controls and framing, and handles resource disposal.
- `aas-web-ui/src/components/Plugins/Submodels/Models3D_v1_0.vue` and its `components/Models3DViewerCard.vue` provide a model/version interface around CADPreview.
- `Models3D_v1_0/utils/parseModel3D.ts` parses model geometry units and bounding vectors. These are not verified rack/server placement coordinates. The fixture's `Capability/Origin` value is `Designed`; do not interpret that provenance field as a coordinate-system origin.
- `aas-web-ui/src/components/Plugins/IfcPreview.vue` provides IFC loading, element highlighting, and property inspection. Its fragment/element identifiers are not proven AAS asset identifiers.
- `examples/CombinedExample/Infrastructure2/aas/IFCShell.aasx` contains a bridge IFC example with placements, rather than a verified rack/server layout.
- The inspected API at `http://localhost:18081/submodels` returned only TimeSeries. The configured default API at `http://localhost:9081` was unavailable. This does not establish that the team's placement data does not exist elsewhere.
- `aas-web-ui/src/composables/Client/SMRepositoryClient.ts` exposes `putSubmodelElement`, which serializes a typed AAS element and sends a PUT request to its supplied path. Whether the actual coordinate elements are writable remains to be established.

Relevant tests include `tests/components/Plugins/CADPreview.test.ts` and `tests/components/Plugins/Submodels/Models3D_v1_0*.test.ts` under `aas-web-ui`. They provide patterns for parsing, attachment handling, framing, and cleanup.

## Supplied positional dataset and implementation scope

Implementation was authorized, including a demonstration dataset. The user then
supplied PositionalData.json; the unchanged sample is kept in examples/SpatialLayout.
It supersedes provisional assumptions about a common length unit or asset geometry.
The sample uses the semantic ID urn:apeirora.eu:idcm:cd:assetPositionalData:Submodel.

- CoordinateSystem.Units declares metres for X/Y and Rack Unit for Z. The sample
  states "value": "0.04445" at line 782 for the Z multiplying factor, with a metre
  physical base. The z=22 → 20 example is therefore 2 rack units, or 88.9 mm.
- ForwardDirection is +X, UpDirection is +Z, and EulerAnglesOrder is YPR. All
  supplied asset angles are zero. Exact axes for nonzero yaw/pitch/roll remain
  unverified; preserve and flag these values rather than guessing their rotation.
- Area.SurfacePolygon is a RackFrontSurface in plane YZ. Polygon Xvalue/Yvalue
  map to Y/Z using the corresponding declared units. No rack volume is supplied.
- Positions is an ordered list. Its Asset ModelReference identifies the AAS;
  CartesianCoordinates contains Xvalue/Yvalue/Zvalue. PositionsOffset is shared
  and additive, and must remain unchanged during an individual correction.
- The first implementation supports references to this submodel's CoordinateSystem,
  preserving unhandled geographic data. External frames need later resolution.
- Demo-only PreviewName, PreviewGeometry and MountingReference extensions are
  explicitly authored and documented. Missing geometry uses position markers;
  missing targets must not be inferred. The original sample remains untouched.

## Required investigation

Before choosing the implementation:

1. Locate a real rack/server AAS or representative sample. Record its submodel IDs, semantic IDs, asset references, and coordinate element paths. Say “I don't know” when the material does not establish an answer, then investigate. Quote relevant source lines before repository-specific claims.
2. Identify the source of truth: AAS placement properties, a placement collection, embedded IFC/CAD transforms, or an external system. Do not invent coordinate properties or endpoints.
3. Establish units, origin, axis directions, handedness, precision, local/global frames, and parent/child relationships. For orientation data, establish its representation and angle units. Do not assume z is vertical, coordinates use metres, or model bounding dimensions are positions.
4. Determine how each scene object maps to a stable asset identity and its editable data. Display names and list indices alone are insufficient.
5. Identify what establishes correct alignment: rack geometry, mounting locations, neighboring assets, or another known reference. The number 22 alone does not establish an error.

If the dataset is unavailable, give a provisional architecture and list the minimum missing information. Do not fabricate a rack schema or claim a working save path.

## Visualization direction

Assess a focused spatial-layout component that reuses existing loading, navigation, resize, and disposal patterns. Explain whether extending an existing viewer or extracting shared viewer utilities is the better fit.

- Render the relevant racks and servers together in a common scene. Camera framing must preserve the relationships that reveal misplacement.
- Show labelled axes, a unit-aware grid, and known reference geometry. Provide useful front, side, and top views plus camera navigation.
- Highlight the selected asset and display its coordinates with units. Where orientation is available, make its direction recognizable; assess rotation editing separately against the data contract.
- Support precise numeric coordinate editing and axis-constrained dragging. Keep camera movement distinct from asset movement.
- Show saved placement as a ghost outline or marker alongside the draft and its coordinate delta.
- Use real model geometry where available. Clearly identify schematic geometry; missing dimensions or positions must not silently become fabricated values or zero coordinates.
- Preserve unsaved edits across camera/view changes. Define selection-change behavior that avoids silently discarding drafts.
- Use existing fonts and theme tokens, clean Vuetify controls, scoped CSS, readable light/dark contrast, accessible labels, keyboard-accessible numeric inputs, and a narrow-screen layout. Set tooltip open delays to 600 ms.

## Coordinate mapping and persistence

Keep coordinate conversion in focused, testable functions. Map stored coordinates and units into scene coordinates, compose parent transforms where required, and apply the inverse mapping before saving. Moving a rack must respect the dataset's child-coordinate semantics; do not automatically rewrite every server's local coordinates.

Maintain separate saved and draft state:

1. Read the authoritative placement and preserve its original typed AAS elements and metadata.
2. Update the preview and numeric inputs together as the user edits. Make no persistence request during dragging or typing.
3. Validate finite values, units, coordinate frames, and any established placement constraints. Do not invent allowable positions.
4. Save only through verified AAS write support and existing request/error handling. Respect editor permissions and backend authorization. Preserve untouched coordinates, descriptions, qualifiers, semantic references, and unrelated asset data.
5. Retain the draft on failure and show a useful error. Re-read confirmed values after success. Account for concurrent changes; do not claim atomic multi-element writes or version checks unless the backend supports them.
6. Cancel restores the last confirmed placement without a write request.

If placement exists only inside IFC/CAD files, updating unrelated AAS properties will not persist that placement. Report the need for verified file editing/export support as a separate dependency. A moved Three.js mesh alone is not a completed save feature.

## First implementation and acceptance criteria

After implementation is authorized, begin with one verified rack and two servers: data mapping, shared preview, numeric editing, then explicit Save/Cancel. Add dragging once coordinate conversion and persistence are proven.

Verify:

- `z=22 → z=20` visibly changes placement by exactly two source units against the established reference.
- x, y, orientation, and unrelated metadata remain unchanged for a z-only correction.
- Local/global conversion, unit conversion, zero and negative values, and parent transforms behave correctly.
- Draft edits cause no backend writes; Cancel restores the saved scene.
- Save targets the correct asset and elements, handles denial/failure, and survives reloading through confirmed backend data.
- Missing data is communicated clearly; loading, selection, resizing, and disposal work.

Run meaningful coordinate/state tests and the required lint and type checks for implementation changes. Browser verification must use the current source runtime. Report verification awaiting a user-controlled build/update when necessary.

## Assessment deliverable

Before implementation, return a concept proposal inside `<proposal>` tags, approximately 300 words and no more than 350. Cover verified data and viewer support, the recommended interaction, coordinate/save mapping, limitations, and the first implementation step. End with at most two essential clarification questions if information is still missing.
