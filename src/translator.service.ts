import { HttpService } from "@nestjs/axios";
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { firstValueFrom } from "rxjs";
import type { TranslatorModuleOptions } from "./translator-module.options";
import { MODULE_OPTIONS_TOKEN } from "./translator.module-definition";
import type {
  OwnlateTranslationsResponse,
  TranslationPlaceholders,
} from "./translator.types";

const TRANSLATIONS_API_URL =
  "https://api.ownlate.com/public/v1/segments/translations-map";
const POLL_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class TranslatorService implements OnModuleInit, OnModuleDestroy {
  private translations: Record<
    string,
    Record<string, Record<string, string>>
  > = {};
  private pollTimer?: NodeJS.Timeout;
  private isLoading = false;
  private readonly logger = new Logger(TranslatorService.name);

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: TranslatorModuleOptions,
    private readonly httpService: HttpService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.loadTranslations();
    this.pollTimer = setInterval(() => {
      void this.refreshTranslations();
    }, POLL_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
  }

  translate(
    namespace: string,
    key: string,
    placeholders?: TranslationPlaceholders,
    locale?: string,
  ): string {
    const resolvedLocale = locale ?? this.options.locale;
    const namespaceTranslations = this.translations[namespace];
    const localeTranslations = namespaceTranslations
      ? this.resolveLocaleTranslations(namespaceTranslations, resolvedLocale)
      : undefined;
    const text = localeTranslations?.[key] ?? key;

    if (!placeholders) {
      return text;
    }

    return Object.entries(placeholders).reduce(
      (result, [placeholderKey, value]) =>
        result.replace(
          new RegExp(`\\{\\{${placeholderKey}\\}\\}`, "g"),
          String(value),
        ),
      text,
    );
  }

  private async refreshTranslations(): Promise<void> {
    if (this.isLoading) {
      return;
    }

    try {
      await this.loadTranslations();
    } catch (error) {
      this.logger.error(
        `Failed to refresh translations: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async loadTranslations(): Promise<void> {
    this.isLoading = true;

    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
      };

      if (this.options.apiKey) {
        headers.Authorization = `Bearer ${this.options.apiKey}`;
      }

      const { data } = await firstValueFrom(
        this.httpService.get<unknown>(TRANSLATIONS_API_URL, {
          headers,
          params: {
            projectId: this.options.projectId,
          },
        }),
      );

      if (this.isErrorResponse(data)) {
        throw new Error(`Failed to load translations: ${data.message}`);
      }

      if (!this.isTranslationsResponse(data)) {
        throw new Error("Failed to load translations: invalid response format");
      }

      this.translations = this.buildTranslations(data);
    } finally {
      this.isLoading = false;
    }
  }

  private isErrorResponse(
    data: unknown,
  ): data is { statusCode: number; message: string } {
    return (
      typeof data === "object" &&
      data !== null &&
      "statusCode" in data &&
      "message" in data
    );
  }

  private isTranslationsResponse(
    data: unknown,
  ): data is OwnlateTranslationsResponse {
    return typeof data === "object" && data !== null;
  }

  private buildTranslations(
    data: OwnlateTranslationsResponse,
  ): Record<string, Record<string, Record<string, string>>> {
    const filesMap = this.options.filesMap ?? {};
    const result: Record<string, Record<string, Record<string, string>>> = {};

    for (const [fileName, languages] of Object.entries(data)) {
      const namespace = filesMap[fileName] ?? fileName.replace(/\.json$/, "");
      result[namespace] = languages;
    }

    return result;
  }

  private resolveLocaleTranslations(
    languages: Record<string, Record<string, string>>,
    locale?: string,
  ): Record<string, string> {
    if (locale) {
      const localeTranslations = languages[locale];
      if (localeTranslations) {
        return localeTranslations;
      }
    }

    const [firstLocale] = Object.keys(languages);
    if (!firstLocale) {
      return {};
    }

    return languages[firstLocale];
  }
}
