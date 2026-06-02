import { t, type UnwrapSchema } from "elysia";

export const SettingsModel = {
  settingsMap: t.Record(t.String(), t.String()),
  singleSetting: t.Object({
    key: t.String(),
    value: t.String(),
  }),
  keyParams: t.Object({
    key: t.String(),
  }),
  okResponse: t.Object({
    ok: t.Boolean(),
  }),
} as const;

export type SettingsModel = {
  [k in keyof typeof SettingsModel]: UnwrapSchema<(typeof SettingsModel)[k]>;
};
