"use client";
import GhostWriterApp from "@/components/GhostWriterApp";
export default function Editor({ params }: { params: { projectId: string } }){ return <GhostWriterApp projectId={params.projectId} />; }