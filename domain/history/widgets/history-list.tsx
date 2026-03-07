"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { ScrollArea } from "@/shared/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { db } from "@/shared/lib/db/dexie";

export function HistoryList() {
  const scans = useLiveQuery(
    () => db.scannedTraits.orderBy("capturedAt").reverse().toArray(),
    [],
  );
  const [openedId, setOpenedId] = useState<string | null>(null);

  if (!scans) {
    return (
      <Card className="hud-panel border-primary/20">
        <CardHeader>
          <CardTitle>Scan History</CardTitle>
        </CardHeader>
        <CardContent>Loading...</CardContent>
      </Card>
    );
  }

  const opened = scans.find((scan) => scan.id === openedId);

  return (
    <Card className="hud-panel border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Scan History ({scans.length})</CardTitle>
        <Badge variant="outline" className="border-primary/40 text-primary">
          Local DB
        </Badge>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[520px] rounded-lg border border-border/70 bg-background/35">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Captured At</TableHead>
                <TableHead>Lock</TableHead>
                <TableHead className="text-right">Matches</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scans.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground"
                  >
                    No saved scan history.
                  </TableCell>
                </TableRow>
              )}
              {scans.map((scan) => (
                <TableRow key={scan.id}>
                  <TableCell>
                    {new Date(scan.capturedAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={scan.lock ? "default" : "secondary"}
                      className={
                        scan.lock ? "bg-emerald-500/85 text-black" : ""
                      }
                    >
                      {scan.lock ? "Locked" : "Unlocked"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {scan.matchedWeapons.length}
                  </TableCell>
                  <TableCell className="text-right">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setOpenedId(scan.id)}
                        >
                          View
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Scan Details</DialogTitle>
                        </DialogHeader>
                        {opened ? (
                          <div className="space-y-3 text-sm">
                            <p>
                              <strong>Captured At:</strong>{" "}
                              {new Date(opened.capturedAt).toLocaleString()}
                            </p>
                            <p>
                              <strong>Lock Status:</strong>{" "}
                              {opened.lock ? "Locked" : "Unlocked"}
                            </p>
                            <p>
                              <strong>Match Count:</strong>{" "}
                              {opened.matchedWeapons.length}
                            </p>
                            <div className="space-y-1 rounded-md border p-3">
                              {opened.lines.map((line) => (
                                <p key={`${opened.id}-${line.lineNo}`}>
                                  {line.lineNo}. {line.rawText} (
                                  {line.optionId ?? "Unmapped"})
                                </p>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
