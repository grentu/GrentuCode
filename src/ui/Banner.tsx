import React from "react";
import { Text, Box } from "ink";
import { VERSION } from "../version";

const BANNER = String.raw`
  ██████  ██████  ███████ ███    ██ ████████ ██    ██
 ██       ██   ██ ██      ████   ██    ██    ██    ██
 ██   ███ ██████  █████   ██ ██  ██    ██    ██    ██
 ██    ██ ██   ██ ██      ██  ██ ██    ██    ██    ██
  ██████  ██   ██ ███████ ██   ████    ██     ██████
`;

const TAGLINE = "AI coding agent";

interface BannerProps {
  primaryColor: string;
  secondaryColor: string;
  mutedColor: string;
  provider: string;
  model: string;
}

export function Banner({ primaryColor, secondaryColor, mutedColor, provider, model }: BannerProps) {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(Text, { color: primaryColor, bold: true }, BANNER),
    React.createElement(
      Box,
      { gap: 2 },
      React.createElement(Text, { color: secondaryColor }, `  ${TAGLINE}`),
      React.createElement(Text, { color: mutedColor, dimColor: true }, VERSION),
    ),
    React.createElement(
      Box,
      { gap: 1, marginTop: 0 },
      React.createElement(Text, { color: mutedColor, dimColor: true }, "Provider:"),
      React.createElement(Text, { color: secondaryColor, bold: true }, provider),
      React.createElement(Text, { color: mutedColor, dimColor: true }, "│"),
      React.createElement(Text, { color: mutedColor, dimColor: true }, "Model:"),
      React.createElement(Text, { color: primaryColor }, model),
    ),
    React.createElement(Text, { color: mutedColor, dimColor: true }, "─".repeat(52)),
  );
}
