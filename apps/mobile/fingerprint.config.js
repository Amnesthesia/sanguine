// The prediction engine is part of the runtime version (D-069): any change under packages/engine/src changes the
// fingerprint, so an over-the-air update carrying an engine change matches no installed build (PLAN.md §6.6, RK-13).
/** @type {import('@expo/fingerprint').Config} */
module.exports = {
  extraSources: [{ type: 'dir', filePath: '../../packages/engine/src', reasons: ['prediction engine ships only as a build'] }],
};
