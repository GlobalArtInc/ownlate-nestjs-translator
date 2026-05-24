import { ConfigurableModuleBuilder } from "@nestjs/common";
import type { TranslatorModuleOptions } from "./translator-module.options";

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<TranslatorModuleOptions>()
  .setClassMethodName("forRoot")
  .setExtras({ isGlobal: true }, (definition, extras) => ({
    ...definition,
    global: extras.isGlobal,
  }))
  .build();
