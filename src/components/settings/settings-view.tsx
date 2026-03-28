"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GeneralSettings } from "@/components/settings/general-settings";
import { UsersSettings } from "@/components/settings/users-settings";
import { InvitationsSettings } from "@/components/settings/invitations-settings";
import { KanbanSettings } from "@/components/settings/kanban-settings";
import { ApiKeysSettings } from "@/components/settings/api-keys-settings";
import { Building2, Users, Mail, Columns3, Key } from "lucide-react";

export function SettingsView() {
  return (
    <Tabs defaultValue="general">
      <TabsList variant="line" className="mb-6">
        <TabsTrigger value="general">
          <Building2 />
          General
        </TabsTrigger>
        <TabsTrigger value="kanban">
          <Columns3 />
          Kanban
        </TabsTrigger>
        <TabsTrigger value="api-keys">
          <Key />
          API Keys
        </TabsTrigger>
        <TabsTrigger value="users">
          <Users />
          Users
        </TabsTrigger>
        <TabsTrigger value="invitations">
          <Mail />
          Invitations
        </TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <GeneralSettings />
      </TabsContent>

      <TabsContent value="kanban">
        <KanbanSettings />
      </TabsContent>

      <TabsContent value="api-keys">
        <ApiKeysSettings />
      </TabsContent>

      <TabsContent value="users">
        <UsersSettings />
      </TabsContent>

      <TabsContent value="invitations">
        <InvitationsSettings />
      </TabsContent>
    </Tabs>
  );
}
