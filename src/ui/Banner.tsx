import React from "react";
import { Text } from "ink";
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
