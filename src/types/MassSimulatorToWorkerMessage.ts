export interface MassSimulatorToWorkerMessage {
  type: "start";
  entrants: string[];
}
