/* ==========================================================================
   Known local design bridges.

   The way an agent reaches Figma differs from setup to setup: the official
   MCP, a local bridge, something else tomorrow. The storybook never owns that
   connection — it only needs to know whether one answers nearby, so it can
   offer a shortcut instead of demanding it.

   Adding a bridge means adding a line here. Nothing else changes: the
   manifest, the prompt and the interface stay as they are.
   ========================================================================== */
'use strict';

module.exports = [
  {
    id: 'hopp',
    label: 'Figma MCP Bridge',
    /* The bridge leader serves plain HTTP next to its plugin socket. */
    ping: 'http://127.0.0.1:1994/ping',
    rpc:  'http://127.0.0.1:1994/rpc',
    shape: 'hopp-rpc'
  }
];
