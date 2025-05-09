import {
  langSchema,
  localizedTextSchema,
  mulmoBeatSchema,
  mulmoScriptSchema,
  mulmoStudioSchema,
  mulmoStudioBeatSchema,
  speakerDictionarySchema,
  mulmoImageParamsSchema,
  mulmoSpeechParamsSchema,
  textSlideParamsSchema,
  speechOptionsSchema,
  mulmoDimensionSchema,
  mulmoScriptTemplateSchema,
} from "./schema";
import { z } from "zod";

export type LANG = z.infer<typeof langSchema>;
export type MulmoBeat = z.infer<typeof mulmoBeatSchema>;
export type SpeakerDictonary = z.infer<typeof speakerDictionarySchema>;
export type MulmoSpeechParams = z.infer<typeof mulmoSpeechParamsSchema>;
export type SpeechOptions = z.infer<typeof speechOptionsSchema>;
export type MulmoImageParams = z.infer<typeof mulmoImageParamsSchema>;
export type TextSlideParams = z.infer<typeof textSlideParamsSchema>;
export type LocalizedText = z.infer<typeof localizedTextSchema>;
export type MulmoScript = z.infer<typeof mulmoScriptSchema>;
export type MulmoDimension = z.infer<typeof mulmoDimensionSchema>;

export type MulmoStudioBeat = z.infer<typeof mulmoStudioBeatSchema>;

export type MulmoStudio = z.infer<typeof mulmoStudioSchema>;
export type MulmoScriptTemplate = z.infer<typeof mulmoScriptTemplateSchema>;

export type FileDirs = {
  mulmoFilePath: string;
  mulmoFileDirPath: string;

  baseDirPath: string;
  outDirPath: string;
  imageDirPath: string;
  scratchpadDirPath: string;
};

export type MulmoStudioContext = {
  fileDirs: FileDirs;
  studio: MulmoStudio;
};

export type ScriptingParams = {
  urls: string[];
  outDirPath: string;
  templateName: string;
  filename: string;
};
