import "dotenv/config";
import { GraphAI, assert } from "graphai";
import type { GraphData, AgentFilterFunction, DefaultParamsType, DefaultResultData } from "graphai";
import * as agents from "@graphai/vanilla";
import { openAIAgent } from "@graphai/openai_agent";
import { fileWriteAgent } from "@graphai/vanilla_node_agents";

import { recursiveSplitJa, replacementsJa, replacePairsJa } from "../utils/string";
import { LANG, LocalizedText, MulmoStudioBeat, MulmoStudioContext } from "../types";
import { getOutputStudioFilePath, mkdir, writingMessage } from "../utils/file";

const translateGraph: GraphData = {
  version: 0.5,
  nodes: {
    studio: {},
    defaultLang: {},
    outDirPath: {},
    outputStudioFilePath: {},
    lang: {
      agent: "stringUpdateTextAgent",
      inputs: {
        newText: ":studio.script.lang",
        oldText: ":defaultLang",
      },
    },
    targetLangs: {}, // TODO
    mergeStudioResult: {
      isResult: true,
      agent: "mergeObjectAgent",
      inputs: {
        items: [":studio", { beats: ":beatsMap.mergeBeatData" }],
      },
    },
    beatsMap: {
      agent: "mapAgent",
      inputs: {
        targetLangs: ":targetLangs",
        rows: ":studio.beats",
        lang: ":lang",
      },
      params: {
        rowKey: "beat",
        compositeResult: true,
      },
      graph: {
        version: 0.5,
        nodes: {
          preprocessBeats: {
            agent: "mapAgent",
            inputs: {
              beat: ":beat",
              rows: ":targetLangs",
              lang: ":lang.text",
            },
            params: {
              compositeResult: true,
              rowKey: "targetLang",
            },
            graph: {
              version: 0.5,
              nodes: {
                localizedTexts: {
                  inputs: {
                    targetLang: ":targetLang",
                    beat: ":beat",
                    lang: ":lang",
                    system: "Please translate the given text into the language specified in language (in locale format, like en, ja, fr, ch).",
                    prompt: ["## Original Language", ":lang", "", "## Language", ":targetLang", "", "## Target", ":beat.text"],
                  },
                  passThrough: {
                    lang: ":targetLang",
                  },
                  output: {
                    text: ".text",
                  },
                  // return { lang, text } <- localizedText
                  agent: "openAIAgent",
                },
                splitText: {
                  agent: (namedInputs: { localizedText: LocalizedText; targetLang: LANG }) => {
                    const { localizedText, targetLang } = namedInputs;
                    // Cache
                    if (localizedText.texts) {
                      return localizedText;
                    }
                    if (targetLang === "ja") {
                      return {
                        ...localizedText,
                        texts: recursiveSplitJa(localizedText.text),
                      };
                    }
                    // not split
                    return {
                      ...localizedText,
                      texts: [localizedText.text],
                    };
                    // return { lang, text, texts }
                  },
                  inputs: {
                    targetLang: ":targetLang",
                    localizedText: ":localizedTexts",
                  },
                },
                ttsTexts: {
                  agent: (namedInputs: { localizedText: LocalizedText; targetLang: LANG }) => {
                    const { localizedText, targetLang } = namedInputs;
                    // cache
                    if (localizedText.ttsTexts) {
                      return localizedText;
                    }
                    if (targetLang === "ja") {
                      return {
                        ...localizedText,
                        ttsTexts: localizedText?.texts?.map((text: string) => replacePairsJa(text, replacementsJa)),
                      };
                    }
                    return {
                      ...localizedText,
                      ttsTexts: localizedText.texts,
                    };
                  },
                  inputs: {
                    targetLang: ":targetLang",
                    localizedText: ":splitText",
                  },
                  isResult: true,
                },
              },
            },
          },
          mergeLocalizedText: {
            agent: "arrayToObjectAgent",
            inputs: {
              items: ":preprocessBeats.ttsTexts",
            },
            params: {
              key: "lang",
            },
          },
          mergeBeatData: {
            isResult: true,
            agent: "mergeObjectAgent",
            inputs: {
              items: [":beat", { multiLingualTexts: ":mergeLocalizedText" }],
            },
          },
        },
      },
    },
    writeOutout: {
      // console: { before: true },
      agent: "fileWriteAgent",
      inputs: {
        file: ":outputStudioFilePath",
        text: ":mergeStudioResult.toJSON()",
      },
    },
  },
};

const localizedTextCacheAgentFilter: AgentFilterFunction<
  DefaultParamsType,
  DefaultResultData,
  { targetLang: LANG; beat: MulmoStudioBeat; lang: LANG }
> = async (context, next) => {
  const { namedInputs } = context;
  const { targetLang, beat, lang } = namedInputs;

  // The original text is unchanged and the target language text is present
  if (
    beat.multiLingualTexts &&
    beat.multiLingualTexts[lang] &&
    beat.multiLingualTexts[lang].text === beat.text &&
    beat.multiLingualTexts[targetLang] &&
    beat.multiLingualTexts[targetLang].text
  ) {
    return { text: beat.multiLingualTexts[targetLang].text };
  }
  // same language
  if (targetLang === lang) {
    return { text: beat.text };
  }
  return await next(context);
};
const agentFilters = [
  {
    name: "localizedTextCacheAgentFilter",
    agent: localizedTextCacheAgentFilter as AgentFilterFunction,
    nodeIds: ["localizedTexts"],
  },
];

const defaultLang = "en";
const targetLangs = ["ja", "en"];

export const translate = async (context: MulmoStudioContext) => {
  const { studio, fileDirs } = context;
  const { outDirPath } = fileDirs;
  const outputStudioFilePath = getOutputStudioFilePath(outDirPath, studio.filename);
  mkdir(outDirPath);

  assert(!!process.env.OPENAI_API_KEY, "The OPENAI_API_KEY environment variable is missing or empty");

  const graph = new GraphAI(translateGraph, { ...agents, fileWriteAgent, openAIAgent }, { agentFilters });
  graph.injectValue("studio", studio);
  graph.injectValue("defaultLang", defaultLang);
  graph.injectValue("targetLangs", targetLangs);
  graph.injectValue("outDirPath", outDirPath);
  graph.injectValue("outputStudioFilePath", outputStudioFilePath);

  await graph.run();
  writingMessage(outputStudioFilePath);
  // const results = await graph.run();
  // const mulmoDataResult = results.mergeResult;
  // console.log(JSON.stringify(mulmoDataResult, null, 2));
};
