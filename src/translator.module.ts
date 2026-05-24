import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { ConfigurableModuleClass } from "./translator.module-definition";
import { TranslatorService } from "./translator.service";

@Module({
  imports: [HttpModule],
  providers: [TranslatorService],
  exports: [TranslatorService],
})
export class TranslatorModule extends ConfigurableModuleClass {}
