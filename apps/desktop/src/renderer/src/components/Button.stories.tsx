import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "@suite/ui";

const meta = {
  title: "Components/Button",
  component: Button,
  args: { children: "Export", variant: "secondary", size: "md" },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Secondary: Story = {};

export const Primary: Story = { args: { variant: "primary" } };

export const Ghost: Story = { args: { variant: "ghost" } };

export const Danger: Story = { args: { variant: "danger", children: "Delete" } };
