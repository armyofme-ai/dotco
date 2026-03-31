"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GeneralSettings } from "@/components/settings/general-settings";
import { UsersSettings } from "@/components/settings/users-settings";
import { InvitationsSettings } from "@/components/settings/invitations-settings";
import { KanbanSettings } from "@/components/settings/kanban-settings";
import { ApiKeysSettings } from "@/components/settings/api-keys-settings";
import { AISettings } from "@/components/settings/ai-settings";
import { Building2, Users, Mail, Columns3, Key, Cpu } from "lucide-react";

interface SettingsViewProps {
  role: string;
}

export function SettingsView({ role }: SettingsViewProps) {
  const isOwner = role === "OWNER";

  return (
    <Tabs defaultValue={isOwner ? "general" : "api-keys"}>
      <TabsList variant="line" className="mb-6">
        {isOwner && (
          <TabsTrigger value="general">
            <Building2 />
            General
          </TabsTrigger>
        )}
        {isOwner && (
          <TabsTrigger value="kanban">
            <Columns3 />
            Kanban
          </TabsTrigger>
        )}
        {isOwner && (
          <TabsTrigger value="ai-providers">
            <Cpu />
            AI Providers
          </TabsTrigger>
        )}
        <TabsTrigger value="api-keys">
          <Key />
          API Keys
        </TabsTrigger>
        {isOwner && (
          <TabsTrigger value="users">
            <Users />
            Users
          </TabsTrigger>
        )}
        {isOwner && (
          <TabsTrigger value="invitations">
            <Mail />
            Invitations
          </TabsTrigger>
        )}
      </TabsList>

      {isOwner && (
        <TabsContent value="general">
          <GeneralSettings />
        </TabsContent>
      )}

      {isOwner && (
        <TabsContent value="kanban">
          <KanbanSettings />
        </TabsContent>
      )}

      {isOwner && (
        <TabsContent value="ai-providers">
          <AISettings />
        </TabsContent>
      )}

      <TabsContent value="api-keys">
        <ApiKeysSettings />
      </TabsContent>

      {isOwner && (
        <TabsContent value="users">
          <UsersSettings />
        </TabsContent>
      )}

      {isOwner && (
        <TabsContent value="invitations">
          <InvitationsSettings />
        </TabsContent>
      )}
    </Tabs>
  );
}
