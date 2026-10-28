import { execute_file } from './pipeline.js'
import type { DetectedGraph } from '../model/Graph.js'

/** Extract graphs from a PDF selected in a browser. */
export async function harvestFile(file: File): Promise<DetectedGraph[]> {
  return execute_file(await file.arrayBuffer(), { hog: false })
}
