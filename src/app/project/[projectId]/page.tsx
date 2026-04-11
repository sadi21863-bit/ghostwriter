"use client";
import GhostWriterApp from "@/components/GhostWriterApp";
export default function Editor({params}){ return <GhostWriterApp projectId={params.projectId} />; }