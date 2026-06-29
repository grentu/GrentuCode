import React from "react";
import { Text } from "ink";

const BANNER = String.raw`
  ██████  ██████  ███████ ███    ██ ████████ ██    ██
 ██       ██   ██ ██      ████   ██    ██    ██    ██
 ██   ███ ██████  █████   ██ ██  ██    ██    ██    ██
 ██    ██ ██   ██ ██      ██  ██ ██    ██    ██    ██
  ██████  ██   ██ ███████ ██   ████    ██     ██████
`;

const VERSION = "v0.1.0";
const TAGLINE = "AI coding agent";

interface BannerProps {
  primaryColor: string;
  secondaryColor: string;
  mutedColor: string;
}

export function Banner({ primaryColor, secondaryColor, mutedColor }: BannerProps) {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(Text, { color: primaryColor, bold: true }, BANNER),
    React.createElement(
      Text,
      null,
      React.createElement(Text, { color: secondaryColor }, `  ${TAGLINE}  `),
      React.createElement(Text, { color: mutedColor, dimColor: true }, VERSION),
    ),
    React.createElement(Text, null, ""),
  );
}
