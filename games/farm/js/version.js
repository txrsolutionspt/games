// Little Farm School — app version, shown in Settings (js/modals.js).
// Kept in its own file (rather than a field in config.js) so a CI check
// can unambiguously tell whether a PR bumped it — see
// .github/workflows/farm-check-version-bump.yml and games/farm/CLAUDE.md
// for the "bump on every release-facing change" rule this backs.
//
// Bump with ./bump-version.sh (no arguments — always increments the patch
// number automatically) before committing a release-facing change.
const APP_VERSION = '1.0.1';

if (typeof module === 'object' && module.exports) {
  module.exports = APP_VERSION;
}
