import React from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Archive,
  Bot,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  Info,
  KeyRound,
  LockKeyhole,
  Loader2,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  MonitorCog,
  Pencil,
  Play,
  Plus,
  Pause,
  Puzzle,
  RefreshCw,
  Rocket,
  Save,
  Search,
  Send,
  Server,
  Settings,
  Shield,
  Sparkles,
  Square,
  Trash2,
  TriangleAlert,
  Upload,
  User,
  X,
} from "lucide-react";
import {
  appShellRecipe,
  badgeRecipe,
  buttonRecipe,
  cardRecipe,
  componentRecipe,
  designTokens,
  inputRecipe,
  overlayRecipe,
  tableRecipe,
} from "../styling.gen";
import { ANTHROPIC_PUBLIC_API_BASE_URL, AnthropicApiError, AnthropicProxyApi, clearAnthropicProxySession, createAnthropicProxySession, readAnthropicProxySession } from "./api/AnthropicProxyApi";
import presetCatalog from "./data/presets.json";
import { clearStoredAnthropicApiKey, readStoredAnthropicApiKey } from "./storage/secureAnthropicKeyStorage";
import { LocalCanvasStore } from "./storage/localCanvasStore";
import "./generic.css";
import "./styles.css";

type JsonObject = Record<string, unknown>;

interface AuthSession {
  token: string;
  uuid: string;
  email: string;
  role?: WorkspaceRole;
}

interface Agent {
  id: string;
  name: string;
  version: number;
  description: string | null;
  system: string | null;
  model: unknown;
  metadata: Record<string, string>;
  tools: unknown[];
  skills: unknown[];
  mcp_servers: unknown[];
  multiagent: unknown | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AgentRecord {
  id: string;
  creator_uuid: string;
  name: string;
  version: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  agent: Agent;
}

interface Member {
  uuid: string;
  email: string;
  role: WorkspaceRole;
}

type WorkspaceRole = "admin" | "member";

interface ApiKeyRecord {
  id: string;
  name: string;
  key_prefix: string;
  project_id: string | null;
  creator_uuid: string | null;
  creator_email: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

interface EmailReceiverRecord {
  id: string;
  name: string;
  domain: string;
  project_id: string;
  creator_uuid: string | null;
  creator_email: string | null;
  created_at: string;
  updated_at: string;
}

type ActiveTab = "chat" | "agents" | "mcpServers" | "integrations" | "packages" | "tutorials" | "skills" | "deployments" | "environments" | "secrets" | "apiKeys" | "members";
type EnvironmentKind = "cloud" | "self_hosted";
type SecretKind = "static_bearer" | "environment_variable";
type McpAuthKind = "no_auth" | SecretKind;
type McpAuthEditKind = "unchanged" | McpAuthKind;
type ScheduleMode = "hours" | "days" | "weeks" | "cron";
type PaletteTab = "triggers" | "agents" | "mcps" | "skills";
type PackageManager = "pip" | "npm" | "apt" | "cargo" | "gem" | "go";

const packageManagers: PackageManager[] = ["pip", "npm", "apt", "cargo", "gem", "go"];

interface McpServerDraft {
  id: string;
  registryId: string;
  name: string;
  url: string;
}

interface RegisteredMcpServer {
  id: string;
  name: string;
  description: string | null;
  url: string;
  icon_data_url: string | null;
  auth_type: McpAuthKind;
  vault_id: string | null;
  credential_id: string | null;
  project_ids: string[];
  created_at: string;
  updated_at: string;
}

interface SkillRecord {
  id: string;
  display_title: string | null;
  description?: string | null;
  latest_version: string | null;
  project_ids?: string[];
  source: "custom" | "anthropic" | string;
  type: string;
  created_at: string;
  updated_at: string;
}

interface IntegrationRecord {
  id: string; name: string; description: string | null; logo_data_url: string | null;
  mcp_server_url: string; mcp_auth_type: "static_bearer" | "environment_variable"; secret_help_url: string | null;
  agent_name: string; agent_description: string | null; agent_system_prompt: string | null; agent_model: string;
  created_at: string; updated_at: string;
}

interface TutorialRecord {
  id: string; title: string; description: string | null; logo_data_url: string | null; markdown: string;
  created_at: string; updated_at: string;
}

interface PackagePresetRecord {
  id: string;
  name: string;
  description: string | null;
  logo_data_url: string | null;
  package_name: string;
  target: PackageManager;
  environment_variables: string[];
  created_at: string;
  updated_at: string;
}

interface SkillDraft {
  id: string;
  type: "anthropic" | "custom";
  skillId: string;
  version: string;
}

interface SubAgentDraft {
  id: string;
  agentId: string;
}

type AgentParameterType = "text" | "number" | "boolean" | "select";

interface AgentParameterDraft {
  id: string;
  key: string;
  label: string;
  type: AgentParameterType;
  defaultValue: string;
  description: string;
  options: string;
}

interface AgentParameterConfig {
  enabled: boolean;
  allowAdditional: boolean;
  parameters: AgentParameterDraft[];
}

interface ScheduleDraft {
  mode: ScheduleMode;
  interval: number;
  minute: number;
  hour: number;
  dayOfWeek: number;
  expression: string;
  timezone: string;
}

type SlackTriggerType = "none" | "all" | "channel" | "user" | "keyword";

interface SlackTriggerDraft {
  type: SlackTriggerType;
  keyword?: string;
  channel_id?: string;
  user_id?: string;
}

interface ApiTriggerDraft {
  api_key_id: string;
}

interface EmailTriggerDraft {
  receiver_id: string;
}

type ProjectNodeType = "play" | "agent" | "schedule" | "mcp" | "skill" | "slack" | "api" | "email";
type ProjectEdgeType = "runs" | "sub_agent" | "schedules" | "uses_mcp" | "uses_skill" | "slack_triggers" | "api_triggers" | "email_triggers";

interface ProjectNode {
  id: string;
  type: ProjectNodeType;
  x: number;
  y: number;
  agent_id?: string;
  mcp_server_id?: string;
  skill_id?: string;
  prompt?: string;
  schedule?: ScheduleDraft;
  slack_trigger?: SlackTriggerDraft;
  api_trigger?: ApiTriggerDraft;
  email_trigger?: EmailTriggerDraft;
  parameter_values?: Record<string, string>;
  session_ids?: string[];
  synced_from_agent_id?: string;
  synced_ref_id?: string;
  synced_role?: "sub_agent" | "mcp" | "skill";
}

interface ProjectEdge {
  id: string;
  source: string;
  target: string;
  type: ProjectEdgeType;
  deployment_id?: string;
}

interface ProjectGraph {
  nodes: ProjectNode[];
  edges: ProjectEdge[];
}

interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

type CanvasViewportsByProject = Record<string, CanvasViewport>;

interface GeneratedAgentSpec {
  name: string;
  description: string;
  system_prompt: string;
  mcp_server_ids: string[];
  required_integration_ids: string[];
}

interface GeneratedProjectPlan {
  project: { name: string };
  agents: Array<{ id: string; name: string; description: string; system_prompt: string; model?: string; skill_ids?: string[] }>;
  triggers: Array<{ id: string; type: "play" | "schedule" | "slack" | "api" | "email"; name: string; description: string; prompt?: string; schedule?: ScheduleDraft; slack_trigger?: SlackTriggerDraft }>;
  mcps: Array<{ id: string; name: string; description: string }>;
  skills: Array<{ id: string; name: string; description: string; type?: "anthropic" | "custom"; skill_id?: string; version?: string }>;
  connections: Array<{ from: string; to: string; type: "runs" | "sub_agent" | "uses_mcp" | "uses_skill" | "schedules" | "slack_triggers" | "api_triggers" | "email_triggers" }>;
}

type CanvasReviewActionId =
  | "create-agent"
  | "update-agent"
  | "add-agent-to-canvas"
  | "add-mcp-to-canvas"
  | "connect-mcp"
  | "connect-sub-agent"
  | "add-trigger"
  | "connect-trigger"
  | "update-trigger";

interface CanvasReviewAction {
  id: string;
  actionId: CanvasReviewActionId;
  title: string;
  rationale: string;
  details: string;
  agent_id?: string;
  agent_name?: string;
  agent_description?: string;
  system_prompt?: string;
  model?: string;
  mcp_server_id?: string;
  mcp_server_ids?: string[];
  required_integration_ids?: string[];
  parent_agent_id?: string;
  child_agent_id?: string;
  sub_agent_ids?: string[];
  target_agent_id?: string;
  trigger_type?: "play" | "schedule" | "slack" | "api" | "email";
  trigger_prompt?: string;
  schedule?: ScheduleDraft;
  slack_trigger?: SlackTriggerDraft;
  node_id?: string;
  source_node_id?: string;
  api_key_id?: string;
  receiver_id?: string;
  add_to_canvas?: boolean;
}

interface CanvasReviewResult {
  summary: string;
  actions: CanvasReviewAction[];
}

interface CanvasReviewApplyResult {
  project: ProjectRecord;
  applied: CanvasReviewAction[];
  skipped: Array<{ id: string; title: string; reason: string }>;
}

interface CanvasReviewValidationContext {
  agentIds: Set<string>;
  mcpServerIds: Set<string>;
  integrationTemplateIds: Set<string>;
  nodeIds: Set<string>;
  triggerNodeIds: Set<string>;
}

interface ProjectRecord {
  id: string;
  name: string;
  creator_uuid: string;
  graph: ProjectGraph;
  is_public: boolean;
  anthropic_environment_id?: string | null;
  anthropic_vault_id?: string | null;
  vault_ids?: string[];
  current_user_role?: "owner" | "editor" | "viewer";
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  awaitingApproval?: ChatApprovalWait | null;
  approvalStatus?: "pending" | "allowed" | "denied";
}

interface ChatApprovalWait {
  event_ids: string[];
  approvals: Array<{
    id: string;
    type: string;
    name?: string;
    mcp_server_name?: string;
    evaluated_permission?: string | null;
    session_thread_id?: string | null;
  } | null>;
  message: string;
}

interface ManagedSession {
  id: string;
  agent: {
    id: string;
    name: string;
    version: number;
    model?: string | { id?: string | null; speed?: string | null } | null;
  };
  archived_at: string | null;
  created_at: string;
  deployment_id?: string | null;
  environment_id: string;
  metadata?: Record<string, string> | null;
  stats?: {
    active_seconds?: number | null;
    duration_seconds?: number | null;
  } | null;
  status: "rescheduling" | "running" | "idle" | "terminated";
  title: string | null;
  updated_at: string;
  usage?: {
    cache_creation?: {
      ephemeral_1h_input_tokens?: number | null;
      ephemeral_5m_input_tokens?: number | null;
    } | null;
    cache_read_input_tokens?: number | null;
    input_tokens?: number | null;
    output_tokens?: number | null;
  } | null;
  vault_ids: string[];
}

interface AnthropicDeployment {
  id: string;
  agent: { id: string; name?: string; version?: number; [key: string]: unknown };
  archived_at: string | null;
  created_at: string;
  description: string | null;
  environment_id: string;
  initial_events: unknown[];
  metadata: Record<string, string>;
  name: string;
  paused_reason: unknown | null;
  resources: unknown[];
  schedule: unknown | null;
  status: "active" | "paused" | string;
  type: "deployment";
  updated_at: string;
  vault_ids: string[];
}

interface AnthropicEnvironment {
  id: string;
  name: string;
  description: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  config: { type: string; [key: string]: unknown };
  metadata: Record<string, string>;
  scope?: "organization" | "account";
}

interface VaultRecord {
  id: string;
  archived_at: string | null;
  can_add_credentials?: boolean;
  can_delete_credentials?: boolean;
  can_delete_vault?: boolean;
  created_at: string;
  display_name: string;
  managed_scope?: "global" | "project" | "external";
  metadata: Record<string, string>;
  project_id?: string | null;
  project_name?: string | null;
  runtime_selectable?: boolean;
  type: "vault";
  updated_at: string;
}

interface VaultCredential {
  id: string;
  archived_at: string | null;
  auth: { type: string; [key: string]: unknown };
  created_at: string;
  display_name?: string | null;
  metadata: Record<string, string>;
  type: "vault_credential";
  updated_at: string;
  vault_id: string;
}

const authStorageKey = "raddus-canvas-anthropic-auth";
const legacyCanvasLocalAuthStorageKey = "canvas-local-anthropic-auth";
const legacyAuthStorageKey = "agent-registry-auth";
const selectedProjectStorageKey = "raddus-canvas-selected-project";
const legacySelectedProjectStorageKey = "agent-registry-selected-project";
const paletteAgentSectionsStorageKey = "raddus-canvas-palette-agent-sections";
const legacyPaletteAgentSectionsStorageKey = "agent-registry-palette-agent-sections";
const paletteMcpSectionsStorageKey = "raddus-canvas-palette-mcp-sections";
const legacyPaletteMcpSectionsStorageKey = "agent-registry-palette-mcp-sections";
const paletteSkillSectionsStorageKey = "raddus-canvas-palette-skill-sections";
const legacyPaletteSkillSectionsStorageKey = "agent-registry-palette-skill-sections";
const canvasViewportsStorageKey = "raddus-canvas-viewports";
const localUserId = "local-anthropic-user";
const localUserEmail = "Local Anthropic key";
const localCanvasStore = new LocalCanvasStore();
const themedStyle = themeVariables();
const defaultCanvasViewport: CanvasViewport = { x: 0, y: 0, zoom: 1 };
const defaultAgentModel = "claude-opus-4-8";
const agentModelOptions = [
  { value: "claude-opus-4-8", label: "Claude Opus 4.8" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
];

function App() {
  const [auth, setAuth] = React.useState<AuthSession | null>(null);
  const [authLoading, setAuthLoading] = React.useState(true);
  const [agents, setAgents] = React.useState<AgentRecord[]>([]);
  const [query, setQuery] = React.useState("");
  const [selectedAgent, setSelectedAgent] = React.useState<AgentRecord | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [firstAgentProjectId, setFirstAgentProjectId] = React.useState<string | null>(null);
  const [createAgentPlacement, setCreateAgentPlacement] = React.useState<{ projectId: string; x: number; y: number } | null>(null);
  const [createdCanvasAgentPlacement, setCreatedCanvasAgentPlacement] = React.useState<{ projectId: string; agentId: string; x: number; y: number; nonce: number } | null>(null);
  const [projects, setProjects] = React.useState<ProjectRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = React.useState(() => readProjectIdFromPath() ?? readStoredSelectedProjectId());
  const [localSettingsReady, setLocalSettingsReady] = React.useState(false);
  const [canvasViewports, setCanvasViewports] = React.useState<CanvasViewportsByProject>(() => readStoredCanvasViewports());
  const [projectsLoading, setProjectsLoading] = React.useState(false);
  const [projectSaving, setProjectSaving] = React.useState(false);
  const [projectRunning, setProjectRunning] = React.useState(false);
  const [projectsError, setProjectsError] = React.useState<string | null>(null);
  const [environmentCreateOpen, setEnvironmentCreateOpen] = React.useState(false);
  const [selectedEnvironment, setSelectedEnvironment] = React.useState<AnthropicEnvironment | null>(null);
  const [deploymentCreateOpen, setDeploymentCreateOpen] = React.useState(false);
  const [selectedDeployment, setSelectedDeployment] = React.useState<AnthropicDeployment | null>(null);
  const [mcpServerCreateOpen, setMcpServerCreateOpen] = React.useState(false);
  const [projectSettingsPageOpen, setProjectSettingsPageOpen] = React.useState(false);
  const [projectCreateOpen, setProjectCreateOpen] = React.useState(false);
  const [canvasReviewOpen, setCanvasReviewOpen] = React.useState(false);
  const [confirmSignOutOpen, setConfirmSignOutOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<ActiveTab>("chat");
  const [chatAgentId, setChatAgentId] = React.useState("");
  const [chatEnvironmentId, setChatEnvironmentId] = React.useState("");
  const [chatVaultIds, setChatVaultIds] = React.useState<string[]>([]);
  const [chatVaultSelectionInitialized, setChatVaultSelectionInitialized] = React.useState(false);
  const [chatInput, setChatInput] = React.useState("");
  const [chatMessagesByConversation, setChatMessagesByConversation] = React.useState<Record<string, ChatMessage[]>>({});
  const [chatSessionsByConversation, setChatSessionsByConversation] = React.useState<Record<string, string>>({});
  const [sessions, setSessions] = React.useState<ManagedSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = React.useState(false);
  const [removingSessionId, setRemovingSessionId] = React.useState<string | null>(null);
  const [stoppingSessionId, setStoppingSessionId] = React.useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = React.useState("");
  const [chatLoading, setChatLoading] = React.useState(false);
  const [approvalLoadingId, setApprovalLoadingId] = React.useState<string | null>(null);
  const [chatError, setChatError] = React.useState<string | null>(null);
  const [environments, setEnvironments] = React.useState<AnthropicEnvironment[]>([]);
  const [environmentLoading, setEnvironmentLoading] = React.useState(false);
  const [environmentSaving, setEnvironmentSaving] = React.useState(false);
  const [environmentError, setEnvironmentError] = React.useState<string | null>(null);
  const [deployments, setDeployments] = React.useState<AnthropicDeployment[]>([]);
  const [deploymentsLoading, setDeploymentsLoading] = React.useState(false);
  const [deploymentSaving, setDeploymentSaving] = React.useState(false);
  const [runningDeploymentId, setRunningDeploymentId] = React.useState<string | null>(null);
  const [deploymentsError, setDeploymentsError] = React.useState<string | null>(null);
  const [mcpServers, setMcpServers] = React.useState<RegisteredMcpServer[]>([]);
  const [mcpServersLoading, setMcpServersLoading] = React.useState(false);
  const [mcpServerSaving, setMcpServerSaving] = React.useState(false);
  const [mcpServersError, setMcpServersError] = React.useState<string | null>(null);
  const [selectedMcpServer, setSelectedMcpServer] = React.useState<RegisteredMcpServer | null>(null);
  const [skills, setSkills] = React.useState<SkillRecord[]>([]);
  const [skillsLoading, setSkillsLoading] = React.useState(false);
  const [skillSaving, setSkillSaving] = React.useState(false);
  const [skillsError, setSkillsError] = React.useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = React.useState<SkillRecord | null>(null);
  const [integrations, setIntegrations] = React.useState<IntegrationRecord[]>([]);
  const [integrationsLoading, setIntegrationsLoading] = React.useState(false);
  const [integrationsError, setIntegrationsError] = React.useState<string | null>(null);
  const [selectedIntegration, setSelectedIntegration] = React.useState<IntegrationRecord | null>(null);
  const [integrationCreateOpen, setIntegrationCreateOpen] = React.useState(false);
  const [integrationInstallOpen, setIntegrationInstallOpen] = React.useState(false);
  const [integrationToInstall, setIntegrationToInstall] = React.useState<IntegrationRecord | null>(null);
  const [mcpServerToInstall, setMcpServerToInstall] = React.useState<RegisteredMcpServer | null>(null);
  const [tutorials, setTutorials] = React.useState<TutorialRecord[]>([]);
  const [tutorialsLoading, setTutorialsLoading] = React.useState(false);
  const [tutorialsError, setTutorialsError] = React.useState<string | null>(null);
  const [selectedTutorial, setSelectedTutorial] = React.useState<TutorialRecord | null>(null);
  const [tutorialCreateOpen, setTutorialCreateOpen] = React.useState(false);
  const [packagePresets, setPackagePresets] = React.useState<PackagePresetRecord[]>([]);
  const [packagePresetsLoading, setPackagePresetsLoading] = React.useState(false);
  const [packagePresetsError, setPackagePresetsError] = React.useState<string | null>(null);
  const [selectedPackagePreset, setSelectedPackagePreset] = React.useState<PackagePresetRecord | null>(null);
  const [packagePresetCreateOpen, setPackagePresetCreateOpen] = React.useState(false);
  const [vaults, setVaults] = React.useState<VaultRecord[]>([]);
  const [vaultsLoading, setVaultsLoading] = React.useState(false);
  const [vaultSaving, setVaultSaving] = React.useState(false);
  const [vaultsError, setVaultsError] = React.useState<string | null>(null);
  const [vaultCreateOpen, setVaultCreateOpen] = React.useState(false);
  const [secretCreateVault, setSecretCreateVault] = React.useState<VaultRecord | null>(null);
  const [expandedVaultIds, setExpandedVaultIds] = React.useState<Set<string>>(() => new Set());
  const [credentialsByVault, setCredentialsByVault] = React.useState<Record<string, VaultCredential[]>>({});
  const [credentialsLoadingByVault, setCredentialsLoadingByVault] = React.useState<Record<string, boolean>>({});
  const [apiKeys, setApiKeys] = React.useState<ApiKeyRecord[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = React.useState(false);
  const [apiKeySaving, setApiKeySaving] = React.useState(false);
  const [apiKeysError, setApiKeysError] = React.useState<string | null>(null);
  const [apiKeyCreateOpen, setApiKeyCreateOpen] = React.useState(false);
  const [emailReceivers, setEmailReceivers] = React.useState<EmailReceiverRecord[]>([]);
  const [emailReceiversLoading, setEmailReceiversLoading] = React.useState(false);
  const [emailReceiverSaving, setEmailReceiverSaving] = React.useState(false);
  const [emailReceiversError, setEmailReceiversError] = React.useState<string | null>(null);
  const [revealedApiKey, setRevealedApiKey] = React.useState<{ name: string; key: string } | null>(null);
  const [members, setMembers] = React.useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = React.useState(false);
  const [membersError, setMembersError] = React.useState<string | null>(null);
  const [memberRoleSavingUuid, setMemberRoleSavingUuid] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const agentsRef = React.useRef<AgentRecord[]>([]);
  const mcpServersRef = React.useRef<RegisteredMcpServer[]>([]);
  const skillsRef = React.useRef<SkillRecord[]>([]);
  const canvasViewportsRef = React.useRef<CanvasViewportsByProject>(canvasViewports);
  const agentConnectorUpdateQueuesRef = React.useRef<Record<string, Promise<void>>>({});

  React.useEffect(() => {
    removeProjectPathFromUrl();
    window.addEventListener("popstate", removeProjectPathFromUrl);
    return () => window.removeEventListener("popstate", removeProjectPathFromUrl);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void readServerLocalSettings().then((settings) => {
      if (cancelled) return;
      cacheServerLocalSettings(settings);
      if (typeof settings.selectedProjectId === "string") {
        setSelectedProjectId(settings.selectedProjectId);
      }
      if (settings.canvasViewports) {
        canvasViewportsRef.current = settings.canvasViewports;
        setCanvasViewports(settings.canvasViewports);
      }
    }).catch(() => undefined).finally(() => {
      if (!cancelled) setLocalSettingsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void readStoredAuth().then((storedAuth) => {
      if (!cancelled) setAuth(storedAuth);
    }).finally(() => {
      if (!cancelled) setAuthLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  React.useEffect(() => {
    mcpServersRef.current = mcpServers;
  }, [mcpServers]);

  React.useEffect(() => {
    skillsRef.current = skills;
  }, [skills]);

  React.useEffect(() => {
    canvasViewportsRef.current = canvasViewports;
  }, [canvasViewports]);

  const storeCanvasViewport = React.useCallback((projectId: string, viewport: CanvasViewport) => {
    const normalized = normalizeCanvasViewport(viewport);
    if (!projectId || !normalized) return;
    const current = canvasViewportsRef.current;
    if (canvasViewportsEqual(current[projectId], normalized)) return;
    const next = { ...current, [projectId]: normalized };
    canvasViewportsRef.current = next;
    setCanvasViewports(next);
    cacheCanvasViewports(next);
    patchServerLocalSettings({ canvasViewports: next });
  }, []);

  const loadProjects = React.useCallback(async () => {
    if (!auth) return;

    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const response = await apiFetch<{ projects: ProjectRecord[] }>("/projects", auth);
      setProjects(response.projects);
      setSelectedProjectId((current) => {
        const stored = readStoredSelectedProjectId();
        return response.projects.find((project) => project.id === current)?.id ?? response.projects.find((project) => project.id === stored)?.id ?? response.projects[0]?.id ?? "";
      });
    } catch (loadError) {
      setProjectsError(errorMessage(loadError));
      if (isUnauthorized(loadError)) {
        clearStoredAuth();
        setAuth(null);
      }
    } finally {
      setProjectsLoading(false);
    }
  }, [auth]);

  React.useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  React.useEffect(() => {
    if (!auth) return;
    const interval = window.setInterval(() => {
      void loadProjects();
    }, 10000);
    return () => window.clearInterval(interval);
  }, [auth, loadProjects]);

  React.useEffect(() => {
    if (!localSettingsReady) return;
    storeSelectedProjectId(selectedProjectId);
  }, [localSettingsReady, selectedProjectId]);

  const loadAgents = React.useCallback(async (): Promise<AgentRecord[]> => {
    if (!auth) return agentsRef.current;

    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<{ agents: AgentRecord[] }>("/agents", auth);
      const sortedAgents = sortAgents(response.agents);
      agentsRef.current = sortedAgents;
      setAgents(sortedAgents);
      return sortedAgents;
    } catch (loadError) {
      setError(errorMessage(loadError));
      if (isUnauthorized(loadError)) {
        clearStoredAuth();
        setAuth(null);
      }
      return agentsRef.current;
    } finally {
      setLoading(false);
    }
  }, [auth]);

  React.useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  const loadEnvironments = React.useCallback(async () => {
    if (!auth) return;

    setEnvironmentLoading(true);
    setEnvironmentError(null);
    try {
      const response = await apiFetch<{ environments: AnthropicEnvironment[] }>("/environments", auth);
      setEnvironments(response.environments);
    } catch (loadError) {
      setEnvironmentError(errorMessage(loadError));
      if (isUnauthorized(loadError)) {
        clearStoredAuth();
        setAuth(null);
      }
    } finally {
      setEnvironmentLoading(false);
    }
  }, [auth]);

  React.useEffect(() => {
    void loadEnvironments();
  }, [loadEnvironments]);

  const loadDeployments = React.useCallback(async () => {
    if (!auth) return;

    setDeploymentsLoading(true);
    setDeploymentsError(null);
    try {
      const response = await apiFetch<{ deployments: AnthropicDeployment[] }>("/deployments", auth);
      setDeployments(response.deployments);
    } catch (loadError) {
      setDeploymentsError(errorMessage(loadError));
      if (isUnauthorized(loadError)) {
        clearStoredAuth();
        setAuth(null);
      }
    } finally {
      setDeploymentsLoading(false);
    }
  }, [auth]);

  React.useEffect(() => {
    void loadDeployments();
  }, [loadDeployments]);

  const loadMcpServers = React.useCallback(async () => {
    if (!auth) return;

    setMcpServersLoading(true);
    setMcpServersError(null);
    try {
      const response = await apiFetch<{ mcpServers: RegisteredMcpServer[] }>("/mcp-servers", auth);
      setMcpServers(response.mcpServers);
    } catch (loadError) {
      setMcpServersError(errorMessage(loadError));
      if (isUnauthorized(loadError)) {
        clearStoredAuth();
        setAuth(null);
      }
    } finally {
      setMcpServersLoading(false);
    }
  }, [auth]);

  React.useEffect(() => {
    void loadMcpServers();
  }, [loadMcpServers]);

  const loadSkills = React.useCallback(async () => {
    if (!auth) return;

    setSkillsLoading(true);
    setSkillsError(null);
    try {
      const response = await apiFetch<{ skills: SkillRecord[] }>("/skills", auth);
      setSkills(response.skills);
    } catch (loadError) {
      setSkillsError(errorMessage(loadError));
      if (isUnauthorized(loadError)) {
        clearStoredAuth();
        setAuth(null);
      }
    } finally {
      setSkillsLoading(false);
    }
  }, [auth]);

  React.useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  const loadIntegrations = React.useCallback(async () => {
    if (!auth) return;
    setIntegrationsLoading(true); setIntegrationsError(null);
    try { setIntegrations((await apiFetch<{ integrations: IntegrationRecord[] }>("/integrations", auth)).integrations); }
    catch (loadError) { setIntegrationsError(errorMessage(loadError)); if (isUnauthorized(loadError)) { clearStoredAuth(); setAuth(null); } }
    finally { setIntegrationsLoading(false); }
  }, [auth]);
  React.useEffect(() => { void loadIntegrations(); }, [loadIntegrations]);

  const loadTutorials = React.useCallback(async () => {
    if (!auth) return;
    setTutorialsLoading(true); setTutorialsError(null);
    try { setTutorials((await apiFetch<{ tutorials: TutorialRecord[] }>("/tutorials", auth)).tutorials); }
    catch (loadError) { setTutorialsError(errorMessage(loadError)); if (isUnauthorized(loadError)) { clearStoredAuth(); setAuth(null); } }
    finally { setTutorialsLoading(false); }
  }, [auth]);
  React.useEffect(() => { void loadTutorials(); }, [loadTutorials]);

  const loadPackagePresets = React.useCallback(async () => {
    if (!auth) return;
    setPackagePresetsLoading(true); setPackagePresetsError(null);
    try { setPackagePresets((await apiFetch<{ packagePresets: PackagePresetRecord[] }>("/package-presets", auth)).packagePresets); }
    catch (loadError) { setPackagePresetsError(errorMessage(loadError)); if (isUnauthorized(loadError)) { clearStoredAuth(); setAuth(null); } }
    finally { setPackagePresetsLoading(false); }
  }, [auth]);
  React.useEffect(() => { void loadPackagePresets(); }, [loadPackagePresets]);

  const loadVaults = React.useCallback(async () => {
    if (!auth) return;

    setVaultsLoading(true);
    setVaultsError(null);
    try {
      const response = await apiFetch<{ vaults: VaultRecord[] }>("/vaults", auth);
      setVaults(response.vaults);
    } catch (loadError) {
      setVaultsError(errorMessage(loadError));
      if (isUnauthorized(loadError)) {
        clearStoredAuth();
        setAuth(null);
      }
    } finally {
      setVaultsLoading(false);
    }
  }, [auth]);

  React.useEffect(() => {
    void loadVaults();
  }, [loadVaults]);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null;
  const selectedProjectCanEdit = selectedProject ? canEditProject(selectedProject) : true;
  const selectedProjectVaultIds = React.useMemo(() => projectVaultIds(selectedProject, vaults), [selectedProject?.anthropic_vault_id, selectedProject?.id, selectedProject?.vault_ids, vaults]);
  const selectedProjectVaultId = selectedProjectVaultIds[0] ?? "";

  const runtimeVaults = React.useMemo(
    () => vaults.filter((vault) => vault.runtime_selectable === true || (vault.runtime_selectable === undefined && vault.managed_scope === undefined)),
    [vaults],
  );

  React.useEffect(() => {
    const vaultIds = selectedProjectVaultIds.length > 0 ? selectedProjectVaultIds : runtimeVaults.map((vault) => vault.id);
    if (vaultIds.length === 0) return;
    const availableVaultIds = new Set(vaults.map((vault) => vault.id));
    if (!chatVaultSelectionInitialized) {
      setChatVaultIds(vaultIds);
      setChatVaultSelectionInitialized(true);
      return;
    }
    setChatVaultIds((current) => {
      const next = current.filter((vaultId) => availableVaultIds.has(vaultId));
      return next.length > 0 ? next : vaultIds;
    });
  }, [runtimeVaults, selectedProjectVaultIds, vaults, chatVaultSelectionInitialized]);

  const loadMembers = React.useCallback(async () => {
    if (!auth) return;

    setMembersLoading(true);
    setMembersError(null);
    try {
      const response = await apiFetch<{ users: Member[] }>("/users", auth);
      setMembers(response.users);
      const localMember = response.users.find((member) => member.uuid === auth.uuid);
      if (localMember && auth.role !== localMember.role) {
        const nextAuth = { ...auth, role: localMember.role };
        setAuth(nextAuth);
      }
    } catch (loadError) {
      setMembersError(errorMessage(loadError));
      if (isUnauthorized(loadError)) {
        clearStoredAuth();
        setAuth(null);
      }
    } finally {
      setMembersLoading(false);
    }
  }, [auth]);

  React.useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const loadApiKeys = React.useCallback(async () => {
    if (!auth) return;

    setApiKeysLoading(true);
    setApiKeysError(null);
    try {
      const response = await apiFetch<{ apiKeys: ApiKeyRecord[] }>("/api-keys", auth);
      setApiKeys(response.apiKeys);
    } catch (loadError) {
      setApiKeysError(errorMessage(loadError));
      if (isUnauthorized(loadError)) {
        clearStoredAuth();
        setAuth(null);
      }
    } finally {
      setApiKeysLoading(false);
    }
  }, [auth]);

  React.useEffect(() => {
    void loadApiKeys();
  }, [loadApiKeys]);

  const loadSessions = React.useCallback(async () => {
    if (!auth) return;

    setSessionsLoading(true);
    try {
      const response = await apiFetch<{ sessions: ManagedSession[] }>("/sessions", auth);
      setSessions(latestSessionsFirst(response.sessions));
    } catch (loadError) {
      setChatError(errorMessage(loadError));
      if (isUnauthorized(loadError)) {
        clearStoredAuth();
        setAuth(null);
      }
    } finally {
      setSessionsLoading(false);
    }
  }, [auth]);

  React.useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  React.useEffect(() => {
    if (!chatAgentId && agents.length > 0) {
      setChatAgentId(agents[0].id);
    }
  }, [agents, chatAgentId]);

  React.useEffect(() => {
    if (!chatEnvironmentId && environments.length > 0) {
      setChatEnvironmentId(environments[0].id);
    }
  }, [environments, chatEnvironmentId]);

  const filteredAgents = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return sortAgents(
      agents.filter((record) => {
        if (!normalized) return true;
        const agent = record.agent;
        return [record.id, agent.name, agent.description ?? "", modelLabel(agent.model), record.creator_uuid].some((value) =>
          value.toLowerCase().includes(normalized),
        );
      }),
    );
  }, [agents, query]);
  const projectAgents = agents;
  const visibleMcpServers = React.useMemo(
    () => mcpServers,
    [mcpServers],
  );
  const createAgentProject = firstAgentProjectId ? projects.find((project) => project.id === firstAgentProjectId) ?? selectedProject : selectedProject;
  const createAgentProjectMcpServers = React.useMemo(
    () => mcpServers,
    [mcpServers],
  );
  const visibleSkills = React.useMemo(
    () => skills.filter((skill) => skillIsBuiltIn(skill) || skillIsGlobal(skill) || Boolean(selectedProject?.id && skillInProject(skill, selectedProject.id))),
    [skills, selectedProject?.id],
  );
  const selectedAgentMcpServers = React.useMemo(() => {
    void selectedAgent;
    return mcpServers;
  }, [mcpServers, selectedAgent]);
  const projectApiKeys = React.useMemo(
    () => apiKeys.filter((apiKey) => apiKey.project_id === selectedProject?.id),
    [apiKeys, selectedProject?.id],
  );
  const projectEmailReceivers = React.useMemo(
    () => emailReceivers.filter((receiver) => receiver.project_id === selectedProject?.id),
    [emailReceivers, selectedProject?.id],
  );
  async function handleAuth(nextAuth: AuthSession, apiKey: string) {
    void apiKey;
    await Promise.allSettled([clearStoredAnthropicApiKey(), writeStoredAuth(nextAuth)]);
    setAuth(nextAuth);
  }

  function signOut() {
    clearStoredAuth();
    setAuth(null);
    setProjects([]);
    setSelectedProjectId("");
    setAgents([]);
    setSelectedAgent(null);
    setCanvasReviewOpen(false);
    setDeployments([]);
    setSelectedDeployment(null);
    setMcpServers([]);
    setVaults([]);
    setApiKeys([]);
    setRevealedApiKey(null);
    setSessions([]);
    setSelectedSessionId("");
    setChatVaultIds([]);
    setChatVaultSelectionInitialized(false);
    setCredentialsByVault({});
    setExpandedVaultIds(new Set());
    setMembers([]);
  }

  async function updateMemberRole(member: Member, role: WorkspaceRole) {
    if (!auth || member.role === role) return;

    setMemberRoleSavingUuid(member.uuid);
    setMembersError(null);
    try {
      const response = await apiFetch<{ users: Member[] }>(`/users/${encodeURIComponent(member.uuid)}`, auth, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      setMembers(response.users);
      const localMember = response.users.find((candidate) => candidate.uuid === auth.uuid);
      if (localMember) {
        const nextAuth = { ...auth, role: localMember.role };
        setAuth(nextAuth);
      }
    } catch (updateError) {
      setMembersError(errorMessage(updateError));
    } finally {
      setMemberRoleSavingUuid(null);
    }
  }

  async function handleCreated(agent: Agent) {
    setCreateOpen(false);
    setFirstAgentProjectId(null);
    await loadAgents();
    if (createAgentPlacement) {
      setCreatedCanvasAgentPlacement({
        ...createAgentPlacement,
        agentId: agent.id,
        nonce: Date.now(),
      });
      setCreateAgentPlacement(null);
    }
  }

  async function handleChanged() {
    setSelectedAgent(null);
    await loadAgents();
  }

  async function createProject(name: string): Promise<ProjectRecord> {
    if (!auth) throw new Error("Sign in before creating a project.");

    setProjectSaving(true);
    setProjectsError(null);
    try {
      const response = await apiFetch<{ project: ProjectRecord }>("/projects", auth, {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          graph: createDefaultProjectGraph(),
        }),
      });
      await loadProjects();
      setSelectedProjectId(response.project.id);
      return response.project;
    } catch (createError) {
      setProjectsError(errorMessage(createError));
      throw createError;
    } finally {
      setProjectSaving(false);
    }
  }

  async function generateAgentSpec(projectId: string, prompt: string): Promise<GeneratedAgentSpec> {
    if (!auth) throw new Error("Sign in before generating an agent.");
    const response = await apiFetch<{ agent: GeneratedAgentSpec }>(`/projects/${encodeURIComponent(projectId)}/agents/generate`, auth, {
      method: "POST",
      body: JSON.stringify({ prompt }),
    });
    return response.agent;
  }

  async function reviewCanvas(project: ProjectRecord, prompt: string): Promise<CanvasReviewResult> {
    if (!auth) throw new Error("Sign in before reviewing the canvas.");
    const response = await apiFetch<{ review: CanvasReviewResult }>(`/projects/${encodeURIComponent(project.id)}/review`, auth, {
      method: "POST",
      body: JSON.stringify({ prompt, graph: project.graph }),
    });
    return response.review;
  }

  async function applyCanvasReviewActions(project: ProjectRecord, actions: CanvasReviewAction[]): Promise<CanvasReviewApplyResult> {
    if (!auth) throw new Error("Sign in before applying review actions.");

    setProjectSaving(true);
    setProjectsError(null);
    try {
      const response = await apiFetch<CanvasReviewApplyResult>(`/projects/${encodeURIComponent(project.id)}/review/apply`, auth, {
        method: "POST",
        body: JSON.stringify({ actions, graph: project.graph }),
      });
      setProjects((current) => current.map((item) => (item.id === response.project.id ? response.project : item)));
      await Promise.all([loadAgents(), loadDeployments()]);
      return response;
    } catch (applyError) {
      setProjectsError(errorMessage(applyError));
      throw applyError;
    } finally {
      setProjectSaving(false);
    }
  }

  async function saveProject(project: ProjectRecord) {
    if (!auth) return;

    const vaultIds = projectVaultIds(project, vaults);
    setProjectSaving(true);
    setProjectsError(null);
    try {
      const response = await apiFetch<{ project: ProjectRecord }>(`/projects/${encodeURIComponent(project.id)}`, auth, {
        method: "PATCH",
        body: JSON.stringify({
          name: project.name,
          graph: project.graph,
          anthropic_environment_id: project.anthropic_environment_id ?? null,
          anthropic_vault_id: vaultIds[0] ?? null,
          vault_ids: vaultIds,
        }),
      });
      setProjects((current) => current.map((item) => (item.id === response.project.id ? response.project : item)));
    } catch (saveError) {
      setProjectsError(errorMessage(saveError));
    } finally {
      setProjectSaving(false);
    }
  }

  async function deleteProject(project: ProjectRecord) {
    if (!auth) return;
    if (!window.confirm(`Remove project "${project.name}"?`)) return;

    setProjectSaving(true);
    setProjectsError(null);
    try {
      await apiFetch<{ ok: true }>(`/projects/${encodeURIComponent(project.id)}`, auth, { method: "DELETE" });
      setProjects((current) => {
        const next = current.filter((item) => item.id !== project.id);
        setSelectedProjectId(next[0]?.id ?? "");
        return next;
      });
    } catch (deleteError) {
      setProjectsError(errorMessage(deleteError));
    } finally {
      setProjectSaving(false);
    }
  }

  async function runProject(project: ProjectRecord, environmentId: string) {
    if (!auth) return;

    setProjectRunning(true);
    setProjectsError(null);
    try {
      await apiFetch<{ session: ManagedSession }>(`/projects/${encodeURIComponent(project.id)}/run`, auth, {
        method: "POST",
        body: JSON.stringify({ environment_id: environmentId, vault_ids: projectVaultIds(project, vaults) }),
      });
      await loadSessions();
      setActiveTab("chat");
    } catch (runError) {
      setProjectsError(errorMessage(runError));
    } finally {
      setProjectRunning(false);
    }
  }

  async function sendChatMessage(event: React.FormEvent) {
    event.preventDefault();
    const content = chatInput.trim();
    if (!content || !chatAgentId || !chatEnvironmentId || chatLoading || !auth) return;
    const vaultIds = chatVaultIds.length > 0 ? chatVaultIds : selectedProjectVaultIds;
    const conversationKey = chatKey(chatAgentId, chatEnvironmentId, vaultIds);

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content };
    setChatMessagesByConversation((current) => ({
      ...current,
      [conversationKey]: [...(current[conversationKey] ?? []), userMessage],
    }));
    setChatInput("");
    setChatLoading(true);
    setChatError(null);

    try {
      const response = await apiFetch<{ sessionId: string; messages: string[]; awaitingApproval?: ChatApprovalWait | null }>(
        "/chat",
        auth,
        {
          method: "POST",
          body: JSON.stringify({
            agentId: chatAgentId,
            environment_id: chatEnvironmentId,
            sessionId: chatSessionsByConversation[conversationKey],
            project_id: selectedProjectId || undefined,
            vault_ids: vaultIds,
            message: content,
          }),
        },
      );
      setChatSessionsByConversation((current) => ({ ...current, [conversationKey]: response.sessionId }));
      setSelectedSessionId(response.sessionId);
      appendChatResponse(conversationKey, response);
      await loadSessions();
    } catch (chatSendError) {
      setChatError(errorMessage(chatSendError));
    } finally {
      setChatLoading(false);
    }
  }

  function appendChatResponse(conversationKey: string, response: { messages: string[]; awaitingApproval?: ChatApprovalWait | null }) {
    const nextMessages: ChatMessage[] =
      response.messages.length > 0
        ? response.messages.map((message) => ({
            id: crypto.randomUUID(),
            role: "assistant" as const,
            content: message,
          }))
        : response.awaitingApproval
          ? [
              {
                id: crypto.randomUUID(),
                role: "assistant" as const,
                content: formatApprovalWait(response.awaitingApproval),
                awaitingApproval: response.awaitingApproval,
                approvalStatus: "pending" as const,
              },
            ]
          : [
              {
                id: crypto.randomUUID(),
                role: "assistant" as const,
                content: "The agent completed without returning text.",
              },
            ];

    setChatMessagesByConversation((current) => ({
      ...current,
      [conversationKey]: [...(current[conversationKey] ?? []), ...nextMessages],
    }));
  }

  async function confirmApproval(message: ChatMessage, result: "allow" | "deny") {
    if (!auth || !message.awaitingApproval || approvalLoadingId || chatLoading) return;
    const vaultIds = chatVaultIds.length > 0 ? chatVaultIds : selectedProjectVaultIds;
    const conversationKey = chatKey(chatAgentId, chatEnvironmentId, vaultIds);
    const sessionId = chatSessionsByConversation[conversationKey];
    const approval = firstToolApproval(message.awaitingApproval);
    if (!sessionId || !approval) return;

    setApprovalLoadingId(message.id);
    setChatError(null);
    setChatMessagesByConversation((current) => ({
      ...current,
      [conversationKey]: (current[conversationKey] ?? []).map((chatMessage) =>
        chatMessage.id === message.id ? { ...chatMessage, approvalStatus: result === "allow" ? "allowed" : "denied" } : chatMessage,
      ),
    }));

    try {
      const response = await apiFetch<{ sessionId: string; messages: string[]; awaitingApproval?: ChatApprovalWait | null }>("/chat/approval", auth, {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          tool_use_id: approval.id,
          result,
          ...(approval.session_thread_id ? { session_thread_id: approval.session_thread_id } : {}),
        }),
      });
      setChatSessionsByConversation((current) => ({ ...current, [conversationKey]: response.sessionId }));
      appendChatResponse(conversationKey, response);
      await loadSessions();
    } catch (approvalError) {
      setChatError(errorMessage(approvalError));
      setChatMessagesByConversation((current) => ({
        ...current,
        [conversationKey]: (current[conversationKey] ?? []).map((chatMessage) =>
          chatMessage.id === message.id ? { ...chatMessage, approvalStatus: "pending" } : chatMessage,
        ),
      }));
    } finally {
      setApprovalLoadingId(null);
    }
  }

  async function selectChatSession(session: ManagedSession) {
    if (!auth) return;

    const vaultIds = session.vault_ids ?? [];
    const conversationKey = chatKey(session.agent.id, session.environment_id, vaultIds);
    setSelectedSessionId(session.id);
    setChatAgentId(session.agent.id);
    setChatEnvironmentId(session.environment_id);
    setChatVaultIds(vaultIds);
    setChatSessionsByConversation((current) => ({ ...current, [conversationKey]: session.id }));
    setChatLoading(true);
    setChatError(null);
    try {
      const response = await apiFetch<{
        messages: Array<{ role: "user" | "assistant"; content: string }>;
        awaitingApproval?: ChatApprovalWait | null;
      }>(`/sessions/${encodeURIComponent(session.id)}/events`, auth);
      const loadedMessages: ChatMessage[] = response.messages.map((message) => ({
        id: crypto.randomUUID(),
        role: message.role,
        content: message.content,
      }));
      if (response.awaitingApproval) {
        loadedMessages.push({
          id: crypto.randomUUID(),
          role: "assistant",
          content: formatApprovalWait(response.awaitingApproval),
          awaitingApproval: response.awaitingApproval,
          approvalStatus: "pending",
        });
      }
      setChatMessagesByConversation((current) => ({ ...current, [conversationKey]: loadedMessages }));
    } catch (selectError) {
      setChatError(errorMessage(selectError));
    } finally {
      setChatLoading(false);
    }
  }

  async function loadSessionMessages(sessionId: string): Promise<ChatMessage[]> {
    if (!auth) return [];
    const response = await apiFetch<{
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      awaitingApproval?: ChatApprovalWait | null;
    }>(`/sessions/${encodeURIComponent(sessionId)}/events`, auth);
    const loadedMessages: ChatMessage[] = response.messages.map((message) => ({
      id: crypto.randomUUID(),
      role: message.role,
      content: message.content,
    }));
    if (response.awaitingApproval) {
      loadedMessages.push({
        id: crypto.randomUUID(),
        role: "assistant",
        content: formatApprovalWait(response.awaitingApproval),
        awaitingApproval: response.awaitingApproval,
        approvalStatus: "pending",
      });
    }
    return loadedMessages;
  }

  async function runCanvasPlay(agentIds: string[], prompt: string, nodeParams: JsonObject, triggerNodeId: string): Promise<string[]> {
    if (!auth) return [];
    const environmentId = selectedProject?.anthropic_environment_id ?? environments[0]?.id;
    if (!environmentId) {
      setProjectsError("Create an environment before running a play card.");
      return [];
    }
    const content = prompt.trim();
    if (!content) {
      setProjectsError("Add a prompt to the play card before running it.");
      return [];
    }

    setProjectRunning(true);
    setProjectsError(null);
    try {
      const sessionIds: string[] = [];
      for (const agentId of agentIds) {
        const message =
          Object.keys(nodeParams).length > 0
            ? JSON.stringify({
                task: content,
                node_params: nodeParams,
              })
            : content;
        const response = await apiFetch<{ sessionId: string; messages: string[]; awaitingApproval?: ChatApprovalWait | null }>("/chat", auth, {
          method: "POST",
          body: JSON.stringify({
            agentId,
            environment_id: environmentId,
            project_id: selectedProjectId || undefined,
            vault_ids: selectedProjectVaultIds,
            trigger_node_id: triggerNodeId,
            message,
          }),
        });
        sessionIds.push(response.sessionId);
      }
      await loadSessions();
      return sessionIds;
    } catch (runError) {
      setProjectsError(errorMessage(runError));
      return [];
    } finally {
      setProjectRunning(false);
    }
  }

  async function sendTriggerSessionMessage(session: ManagedSession, message: string): Promise<void> {
    if (!auth) throw new Error("Sign in before sending a message.");
    await apiFetch<{ sessionId: string }>("/chat", auth, {
      method: "POST",
      body: JSON.stringify({
        agentId: session.agent.id,
        sessionId: session.id,
        message,
      }),
    });
    await loadSessions();
  }

  async function stopChatSession(session: ManagedSession): Promise<void> {
    if (!auth) throw new Error("Sign in before stopping a session.");
    if (stoppingSessionId) return;

    setStoppingSessionId(session.id);
    try {
      await apiFetch<{ events: unknown }>(`/sessions/${encodeURIComponent(session.id)}/interrupt`, auth, { method: "POST" });
      await loadSessions();
    } finally {
      setStoppingSessionId(null);
    }
  }

  async function removeChatSession(session: ManagedSession) {
    if (!auth || removingSessionId) return;

    const vaultIds = session.vault_ids ?? [];
    const conversationKey = chatKey(session.agent.id, session.environment_id, vaultIds);
    setRemovingSessionId(session.id);
    setChatError(null);
    try {
      await apiFetch<{ session: unknown }>(`/sessions/${encodeURIComponent(session.id)}`, auth, { method: "DELETE" });
      setSessions((current) => current.filter((item) => item.id !== session.id));
      setChatSessionsByConversation((current) => {
        const next = { ...current };
        if (next[conversationKey] === session.id) {
          delete next[conversationKey];
        }
        return next;
      });
      setChatMessagesByConversation((current) => {
        const next = { ...current };
        delete next[conversationKey];
        return next;
      });
      if (selectedSessionId === session.id) {
        setSelectedSessionId("");
      }
      await loadSessions();
    } catch (removeError) {
      setChatError(errorMessage(removeError));
    } finally {
      setRemovingSessionId(null);
    }
  }

  async function createEnvironment(payload: JsonObject): Promise<AnthropicEnvironment | null> {
    if (!auth) return null;

    setEnvironmentSaving(true);
    setEnvironmentError(null);
    try {
      const response = await apiFetch<{ environment: AnthropicEnvironment }>("/environments", auth, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await loadEnvironments();
      return response.environment;
    } catch (createError) {
      setEnvironmentError(errorMessage(createError));
      throw createError;
    } finally {
      setEnvironmentSaving(false);
    }
  }

  async function updateEnvironment(environmentId: string, payload: JsonObject) {
    if (!auth) return;

    setEnvironmentSaving(true);
    setEnvironmentError(null);
    try {
      await apiFetch<{ environment: AnthropicEnvironment }>(`/environments/${encodeURIComponent(environmentId)}`, auth, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      await loadEnvironments();
    } catch (updateError) {
      setEnvironmentError(errorMessage(updateError));
      throw updateError;
    } finally {
      setEnvironmentSaving(false);
    }
  }

  async function deleteEnvironment(environmentId: string) {
    if (!auth) return;

    setEnvironmentSaving(true);
    setEnvironmentError(null);
    try {
      await apiFetch<{ environment: unknown }>(`/environments/${encodeURIComponent(environmentId)}`, auth, { method: "DELETE" });
      setSelectedEnvironment((current) => (current?.id === environmentId ? null : current));
      setProjects((current) => current.map((project) => (
        project.anthropic_environment_id === environmentId ? { ...project, anthropic_environment_id: null } : project
      )));
      await loadEnvironments();
    } catch (deleteError) {
      setEnvironmentError(errorMessage(deleteError));
      throw deleteError;
    } finally {
      setEnvironmentSaving(false);
    }
  }

  async function createDeployment(payload: JsonObject) {
    if (!auth) return null;

    setDeploymentSaving(true);
    setDeploymentsError(null);
    try {
      const response = await apiFetch<{ deployment: AnthropicDeployment }>("/deployments", auth, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await loadDeployments();
      return response.deployment;
    } catch (createError) {
      setDeploymentsError(errorMessage(createError));
      throw createError;
    } finally {
      setDeploymentSaving(false);
    }
  }

  function enqueueAgentConnectorUpdate(agentId: string, task: () => Promise<void>) {
    const previous = agentConnectorUpdateQueuesRef.current[agentId] ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(task)
      .finally(() => {
        if (agentConnectorUpdateQueuesRef.current[agentId] === next) {
          delete agentConnectorUpdateQueuesRef.current[agentId];
        }
      });
    agentConnectorUpdateQueuesRef.current[agentId] = next;
    return next;
  }

  async function updateAgentSubAgent(agentId: string, subAgentId: string, enabled: boolean) {
    if (!auth) return;
    setError(null);
    void enqueueAgentConnectorUpdate(agentId, async () => {
      try {
        await patchAgentSubAgent(agentId, subAgentId, enabled);
      } catch (updateError) {
        if (!isConflict(updateError)) {
          setProjectsError(errorMessage(updateError));
          return;
        }
        await loadAgents();
        try {
          await patchAgentSubAgent(agentId, subAgentId, enabled);
        } catch (retryError) {
          setProjectsError(errorMessage(retryError));
        }
      }
    });
  }

  async function updateAgentMcp(agentId: string, mcpServerId: string, enabled: boolean) {
    if (!auth) return;
    setError(null);
    void enqueueAgentConnectorUpdate(agentId, async () => {
      try {
        await patchAgentMcp(agentId, mcpServerId, enabled);
      } catch (updateError) {
        if (!isConflict(updateError)) {
          setProjectsError(errorMessage(updateError));
          return;
        }
        await loadAgents();
        try {
          await patchAgentMcp(agentId, mcpServerId, enabled);
        } catch (retryError) {
          setProjectsError(errorMessage(retryError));
        }
      }
    });
  }

  async function updateAgentSkill(agentId: string, skillId: string, enabled: boolean) {
    if (!auth) return;
    setError(null);
    void enqueueAgentConnectorUpdate(agentId, async () => {
      try {
        await patchAgentSkill(agentId, skillId, enabled);
      } catch (updateError) {
        if (!isConflict(updateError)) {
          setProjectsError(errorMessage(updateError));
          return;
        }
        await loadAgents();
        try {
          await patchAgentSkill(agentId, skillId, enabled);
        } catch (retryError) {
          setProjectsError(errorMessage(retryError));
        }
      }
    });
  }

  async function patchAgentSubAgent(agentId: string, subAgentId: string, enabled: boolean) {
    if (!auth) return;
    const record = agentsRef.current.find((item) => item.id === agentId);
    if (!record) return;
    const currentIds = subAgentIds(record.agent.multiagent);
    const nextIds = enabled ? [...new Set([...currentIds, subAgentId])] : currentIds.filter((id) => id !== subAgentId);
    const subAgents = nextIds.map((id) => ({ id: crypto.randomUUID(), agentId: id }));

    await apiFetch<{ agent: Agent }>(`/agents/${encodeURIComponent(agentId)}`, auth, {
      method: "PATCH",
      body: JSON.stringify({
        version: record.agent.version,
        multiagent: serializeSubAgents(subAgents),
      }),
    });
    await loadAgents();
  }

  async function patchAgentMcp(agentId: string, mcpServerId: string, enabled: boolean) {
    if (!auth) return;
    const record = agentsRef.current.find((item) => item.id === agentId);
    const server = mcpServersRef.current.find((item) => item.id === mcpServerId);
    if (!record || !server) return;

    const currentDrafts = mcpServerDraftsFromAgent(record.agent.mcp_servers, mcpServersRef.current);
    const nextDrafts = enabled
      ? currentDrafts.some((draft) => draft.registryId === server.id)
        ? currentDrafts
        : [...currentDrafts, mcpServerDraftFromRegistered(server)]
      : currentDrafts.filter((draft) => draft.registryId !== server.id);
    const selectedMcpServers = serializeMcpServerDrafts(nextDrafts, mcpServersRef.current);

    await apiFetch<{ agent: Agent }>(`/agents/${encodeURIComponent(agentId)}`, auth, {
      method: "PATCH",
      body: JSON.stringify({
        version: record.agent.version,
        mcp_servers: selectedMcpServers,
        tools: serializeMcpToolsets(selectedMcpServers),
      }),
    });
    await loadAgents();
  }

  async function patchAgentSkill(agentId: string, skillId: string, enabled: boolean) {
    if (!auth) return;
    const record = agentsRef.current.find((item) => item.id === agentId);
    const skill = skillsRef.current.find((item) => item.id === skillId);
    if (!record || !skill) return;

    const currentDrafts = skillDraftsFromAgent(record.agent.skills);
    const nextSkill: SkillDraft = {
      id: crypto.randomUUID(),
      type: skill.source === "anthropic" ? "anthropic" : "custom",
      skillId: skill.id,
      version: skill.latest_version ?? "",
    };
    const nextDrafts = enabled
      ? currentDrafts.some((draft) => draft.skillId === skill.id)
        ? currentDrafts
        : [...currentDrafts, nextSkill]
      : currentDrafts.filter((draft) => draft.skillId !== skill.id);

    await apiFetch<{ agent: Agent }>(`/agents/${encodeURIComponent(agentId)}`, auth, {
      method: "PATCH",
      body: JSON.stringify({
        version: record.agent.version,
        skills: serializeSkillDrafts(nextDrafts),
      }),
    });
    await loadAgents();
  }

  async function createSkill(payload: { name: string; description: string; files: File[]; publicUrl: string; projectIds: string[] }) {
    if (!auth) return;

    setSkillSaving(true);
    setSkillsError(null);
    try {
      const form = skillFormData(payload);
      form.append("display_title", payload.name.trim());
      form.append("description", payload.description.trim());
      form.append("project_ids", JSON.stringify(payload.projectIds));
      await apiFetch<{ skill: SkillRecord }>("/skills", auth, {
        method: "POST",
        body: form,
      });
      await loadSkills();
    } catch (createError) {
      setSkillsError(errorMessage(createError));
      throw createError;
    } finally {
      setSkillSaving(false);
    }
  }

  async function createSkillVersion(skillId: string, payload: { files: File[]; publicUrl: string }) {
    if (!auth) return;

    setSkillSaving(true);
    setSkillsError(null);
    try {
      await apiFetch<{ version: unknown }>(`/skills/${encodeURIComponent(skillId)}/versions`, auth, {
        method: "POST",
        body: skillFormData(payload),
      });
      await loadSkills();
      setSelectedSkill((current) => (current?.id === skillId ? (skillsRef.current.find((skill) => skill.id === skillId) ?? current) : current));
    } catch (updateError) {
      setSkillsError(errorMessage(updateError));
      throw updateError;
    } finally {
      setSkillSaving(false);
    }
  }

  async function updateSkillMetadata(skillId: string, payload: { name: string; description: string; projectIds: string[] }) {
    if (!auth) return;

    setSkillSaving(true);
    setSkillsError(null);
    try {
      await apiFetch<{ skill: SkillRecord }>(`/skills/${encodeURIComponent(skillId)}`, auth, {
        method: "PATCH",
        body: JSON.stringify({
          display_title: payload.name.trim(),
          description: nullableText(payload.description),
          project_ids: payload.projectIds,
        }),
      });
      await loadSkills();
      setSelectedSkill((current) => (current?.id === skillId ? (skillsRef.current.find((skill) => skill.id === skillId) ?? current) : current));
    } catch (updateError) {
      setSkillsError(errorMessage(updateError));
      throw updateError;
    } finally {
      setSkillSaving(false);
    }
  }

  async function saveIntegration(payload: Omit<IntegrationRecord, "id" | "created_at" | "updated_at">, existing?: IntegrationRecord) {
    if (!auth) return;
    const path = existing ? `/integrations/${encodeURIComponent(existing.id)}` : "/integrations";
    await apiFetch(path, auth, { method: existing ? "PATCH" : "POST", body: JSON.stringify(payload) });
    await loadIntegrations();
  }

  async function removeIntegration(integration: IntegrationRecord) {
    if (!auth || !window.confirm(`Delete integration "${integration.name}"?`)) return;
    await apiFetch(`/integrations/${encodeURIComponent(integration.id)}`, auth, { method: "DELETE" });
    setSelectedIntegration(null); await loadIntegrations();
  }

  async function saveTutorial(payload: Omit<TutorialRecord, "id" | "created_at" | "updated_at">, existing?: TutorialRecord) {
    if (!auth) return;
    const path = existing ? `/tutorials/${encodeURIComponent(existing.id)}` : "/tutorials";
    await apiFetch(path, auth, { method: existing ? "PATCH" : "POST", body: JSON.stringify(payload) });
    await loadTutorials();
  }

  async function removeTutorial(tutorial: TutorialRecord) {
    if (!auth || !window.confirm(`Delete tutorial "${tutorial.title}"?`)) return;
    await apiFetch(`/tutorials/${encodeURIComponent(tutorial.id)}`, auth, { method: "DELETE" });
    setSelectedTutorial(null); await loadTutorials();
  }

  async function savePackagePreset(payload: Omit<PackagePresetRecord, "id" | "created_at" | "updated_at">, existing?: PackagePresetRecord) {
    if (!auth) return;
    const path = existing ? `/package-presets/${encodeURIComponent(existing.id)}` : "/package-presets";
    await apiFetch(path, auth, { method: existing ? "PATCH" : "POST", body: JSON.stringify(payload) });
    await loadPackagePresets();
  }

  async function removePackagePreset(packagePreset: PackagePresetRecord) {
    if (!auth || !window.confirm(`Delete package preset "${packagePreset.name}"?`)) return;
    await apiFetch(`/package-presets/${encodeURIComponent(packagePreset.id)}`, auth, { method: "DELETE" });
    setSelectedPackagePreset(null); await loadPackagePresets();
  }

  async function installProjectMcpServer(server: RegisteredMcpServer, authPayload: JsonObject) {
    if (!auth || !selectedProject) return;
    const vaultId = projectVaultId(selectedProject, vaults);
    await apiFetch<{ mcpServer: RegisteredMcpServer }>("/mcp-servers", auth, {
      method: "POST",
      body: JSON.stringify({
        id: server.id,
        name: server.name,
        description: server.description,
        url: server.url,
        icon_data_url: server.icon_data_url,
        auth_type: server.auth_type,
        vault_id: vaultId || server.vault_id,
        credential_id: server.credential_id,
        project_ids: [selectedProject.id],
        auth: authPayload,
      }),
    });
    await Promise.all([loadMcpServers(), loadVaults(), vaultId ? loadVaultCredentials(vaultId) : Promise.resolve()]);
  }

  async function installProjectPackage(packagePreset: PackagePresetRecord, environmentValues: Record<string, string>) {
    if (!auth || !selectedProject) return;
    await apiFetch<{ packagePreset: PackagePresetRecord; environment: AnthropicEnvironment }>(`/projects/${encodeURIComponent(selectedProject.id)}/package-presets/${encodeURIComponent(packagePreset.id)}/install`, auth, {
      method: "POST",
      body: JSON.stringify({ environment_values: environmentValues, vault_id: projectVaultId(selectedProject, vaults) || undefined }),
    });
    const vaultId = projectVaultId(selectedProject, vaults);
    await Promise.all([loadProjects(), loadEnvironments(), loadVaults(), vaultId ? loadVaultCredentials(vaultId) : Promise.resolve()]);
  }

  function skillFormData(payload: { files: File[]; publicUrl: string }) {
    const form = new FormData();
    if (payload.publicUrl.trim()) form.append("public_url", payload.publicUrl.trim());
    for (const file of payload.files) {
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      form.append("files", file, relativePath);
    }
    return form;
  }

  async function createScheduledDeploymentFromCanvas(project: ProjectRecord, _graph: ProjectGraph, scheduleNode: ProjectNode, agentNode: ProjectNode) {
    const projectEnvironment = environmentForProject(project, environments) ?? environments[0];
    const agentRecord = agentNode?.agent_id ? agents.find((record) => record.id === agentNode.agent_id) : undefined;
    if (!projectEnvironment || !agentRecord || !scheduleNode.schedule) return null;

    const deployment = await createDeployment({
      name: `${project.name || "Canvas"} · ${agentRecord.agent.name}`,
      description: `Created from ${project.name || "My Canvas"}.`,
      agent: agentRecord.id,
      environment_id: projectEnvironment.id,
      initial_events: deploymentInitialEvents(scheduleNode.prompt?.trim() || "Run this deployment."),
      resources: [],
      metadata: {
        project_id: project.id,
        schedule_node_id: scheduleNode.id,
        agent_node_id: agentNode.id,
      },
      schedule: {
        type: "cron",
        expression: cronExpressionForSchedule(scheduleNode.schedule),
        timezone: scheduleNode.schedule.timezone,
      },
    });
    return deployment?.id ?? null;
  }

  async function updateDeployment(deploymentId: string, payload: JsonObject) {
    if (!auth) return;

    setDeploymentSaving(true);
    setDeploymentsError(null);
    try {
      await apiFetch<{ deployment: AnthropicDeployment }>(`/deployments/${encodeURIComponent(deploymentId)}`, auth, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setSelectedDeployment(null);
      await loadDeployments();
    } catch (updateError) {
      setDeploymentsError(errorMessage(updateError));
      throw updateError;
    } finally {
      setDeploymentSaving(false);
    }
  }

  async function deleteDeployment(deploymentId: string) {
    if (!auth) return;

    setDeploymentSaving(true);
    setDeploymentsError(null);
    try {
      await apiFetch<{ deployment: AnthropicDeployment }>(`/deployments/${encodeURIComponent(deploymentId)}`, auth, { method: "DELETE" });
      setSelectedDeployment(null);
      await loadDeployments();
    } catch (deleteError) {
      setDeploymentsError(errorMessage(deleteError));
      throw deleteError;
    } finally {
      setDeploymentSaving(false);
    }
  }

  async function runDeployment(deploymentId: string) {
    if (!auth || runningDeploymentId) return;

    setRunningDeploymentId(deploymentId);
    setDeploymentsError(null);
    try {
      await apiFetch<{ run: unknown }>(`/deployments/${encodeURIComponent(deploymentId)}/run`, auth, {
        method: "POST",
        body: "{}",
      });
      await Promise.all([loadDeployments(), loadSessions()]);
    } catch (runError) {
      setDeploymentsError(errorMessage(runError));
    } finally {
      setRunningDeploymentId(null);
    }
  }

  async function createMcpServer(payload: JsonObject) {
    if (!auth) return;

    setMcpServerSaving(true);
    setMcpServersError(null);
    try {
      await apiFetch<{ mcpServer: RegisteredMcpServer }>("/mcp-servers", auth, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await Promise.all([loadMcpServers(), loadVaults()]);
    } catch (createError) {
      setMcpServersError(errorMessage(createError));
      throw createError;
    } finally {
      setMcpServerSaving(false);
    }
  }

  async function updateMcpServer(serverId: string, payload: JsonObject) {
    if (!auth) return;

    setMcpServerSaving(true);
    setMcpServersError(null);
    try {
      await apiFetch<{ mcpServer: RegisteredMcpServer }>(`/mcp-servers/${encodeURIComponent(serverId)}`, auth, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      await Promise.all([loadMcpServers(), loadVaults()]);
    } catch (updateError) {
      setMcpServersError(errorMessage(updateError));
      throw updateError;
    } finally {
      setMcpServerSaving(false);
    }
  }

  async function createApiKey(name: string, projectId = selectedProjectId): Promise<{ apiKey: ApiKeyRecord; key: string } | null> {
    if (!auth) return null;
    if (!projectId) throw new Error("Select a project before creating an API key.");

    setApiKeySaving(true);
    setApiKeysError(null);
    try {
      const response = await apiFetch<{ apiKey: ApiKeyRecord; key: string }>("/api-keys", auth, {
        method: "POST",
        body: JSON.stringify({ name, project_id: projectId }),
      });
      setRevealedApiKey({ name: response.apiKey.name, key: response.key });
      await loadApiKeys();
      return response;
    } catch (createError) {
      setApiKeysError(errorMessage(createError));
      throw createError;
    } finally {
      setApiKeySaving(false);
    }
  }

  async function rotateApiKey(apiKey: ApiKeyRecord, confirm = true): Promise<{ apiKey: ApiKeyRecord; key: string } | null> {
    if (!auth) return null;
    if (confirm && !window.confirm(`Rotate API key "${apiKey.name}"? Existing clients using this key will stop authenticating.`)) return null;

    setApiKeySaving(true);
    setApiKeysError(null);
    try {
      const response = await apiFetch<{ apiKey: ApiKeyRecord; key: string }>(`/api-keys/${encodeURIComponent(apiKey.id)}/rotate`, auth, {
        method: "POST",
        body: "{}",
      });
      setRevealedApiKey({ name: response.apiKey.name, key: response.key });
      await loadApiKeys();
      return response;
    } catch (rotateError) {
      setApiKeysError(errorMessage(rotateError));
      throw rotateError;
    } finally {
      setApiKeySaving(false);
    }
  }

  async function deleteApiKey(apiKey: ApiKeyRecord) {
    if (!auth) return;
    if (!window.confirm(`Delete API key "${apiKey.name}"? Clients using this key will stop authenticating.`)) return;

    setApiKeySaving(true);
    setApiKeysError(null);
    try {
      await apiFetch<{ ok: true }>(`/api-keys/${encodeURIComponent(apiKey.id)}`, auth, { method: "DELETE" });
      setRevealedApiKey((current) => (current?.name === apiKey.name ? null : current));
      await loadApiKeys();
    } catch (deleteError) {
      setApiKeysError(errorMessage(deleteError));
    } finally {
      setApiKeySaving(false);
    }
  }

  async function createEmailReceiver(name: string, projectId = selectedProjectId): Promise<{ emailReceiver: EmailReceiverRecord } | null> {
    void name;
    void projectId;
    throw new Error("Email triggers are no longer available.");
  }

  async function loadVaultCredentials(vaultId: string) {
    if (!auth) return;

    setCredentialsLoadingByVault((current) => ({ ...current, [vaultId]: true }));
    setVaultsError(null);
    try {
      const response = await apiFetch<{ credentials: VaultCredential[] }>(`/vaults/${encodeURIComponent(vaultId)}/credentials`, auth);
      setCredentialsByVault((current) => ({ ...current, [vaultId]: response.credentials }));
    } catch (loadError) {
      setVaultsError(errorMessage(loadError));
      if (isUnauthorized(loadError)) {
        clearStoredAuth();
        setAuth(null);
      }
    } finally {
      setCredentialsLoadingByVault((current) => ({ ...current, [vaultId]: false }));
    }
  }

  React.useEffect(() => {
    if (!auth || !selectedProjectVaultId) return;
    if (credentialsByVault[selectedProjectVaultId] || credentialsLoadingByVault[selectedProjectVaultId]) return;
    void loadVaultCredentials(selectedProjectVaultId);
  }, [auth, selectedProjectVaultId, credentialsByVault, credentialsLoadingByVault]);

  async function toggleVault(vaultId: string) {
    const isExpanded = expandedVaultIds.has(vaultId);
    setExpandedVaultIds((current) => {
      const next = new Set(current);
      if (next.has(vaultId)) {
        next.delete(vaultId);
      } else {
        next.add(vaultId);
      }
      return next;
    });
    if (!isExpanded && !credentialsByVault[vaultId]) {
      await loadVaultCredentials(vaultId);
    }
  }

  async function createVault(payload: { display_name: string }): Promise<VaultRecord | null> {
    if (!auth) return null;

    setVaultSaving(true);
    setVaultsError(null);
    try {
      const response = await apiFetch<{ vault: VaultRecord }>("/vaults", auth, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await loadVaults();
      return response.vault;
    } catch (createError) {
      setVaultsError(errorMessage(createError));
      throw createError;
    } finally {
      setVaultSaving(false);
    }
  }

  async function createAndSelectProjectVault(project: ProjectRecord, payload?: { display_name?: string; vault_ids?: string[] }): Promise<VaultRecord | null> {
    if (!auth) return null;

    setProjectSaving(true);
    setProjectsError(null);
    try {
      const displayName = payload?.display_name?.trim() || defaultProjectVaultName(project);
      const vault = await createVault({ display_name: displayName });
      if (!vault) return null;
      const vaultIds = uniqueStrings([...(payload?.vault_ids ?? projectVaultIds(project, vaults)), vault.id]);
      const response = await apiFetch<{ project: ProjectRecord }>(`/projects/${encodeURIComponent(project.id)}`, auth, {
        method: "PATCH",
        body: JSON.stringify({
          name: project.name,
          graph: project.graph,
          anthropic_environment_id: project.anthropic_environment_id ?? null,
          anthropic_vault_id: vaultIds[0] ?? null,
          vault_ids: vaultIds,
        }),
      });
      setProjects((current) => current.map((item) => (item.id === response.project.id ? response.project : item)));
      return vault;
    } catch (createError) {
      setProjectsError(errorMessage(createError));
      throw createError;
    } finally {
      setProjectSaving(false);
    }
  }

  async function createAndSelectProjectEnvironment(project: ProjectRecord, payload?: JsonObject): Promise<AnthropicEnvironment | null> {
    if (!auth) return null;

    setProjectSaving(true);
    setProjectsError(null);
    try {
      const environment = await createEnvironment(payload ?? {
        name: defaultProjectEnvironmentName(project),
        config: defaultEnvironmentConfig("cloud"),
      });
      if (!environment) return null;
      const vaultIds = projectVaultIds(project, vaults);
      const response = await apiFetch<{ project: ProjectRecord }>(`/projects/${encodeURIComponent(project.id)}`, auth, {
        method: "PATCH",
        body: JSON.stringify({
          name: project.name,
          graph: project.graph,
          anthropic_environment_id: environment.id,
          anthropic_vault_id: vaultIds[0] ?? null,
          vault_ids: vaultIds,
        }),
      });
      setProjects((current) => current.map((item) => (item.id === response.project.id ? response.project : item)));
      return environment;
    } catch (createError) {
      setProjectsError(errorMessage(createError));
      throw createError;
    } finally {
      setProjectSaving(false);
    }
  }

  async function createVaultCredential(vaultId: string, payload: JsonObject) {
    if (!auth) return;

    setVaultSaving(true);
    setVaultsError(null);
    try {
      await apiFetch<{ credential: VaultCredential }>(`/vaults/${encodeURIComponent(vaultId)}/credentials`, auth, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setExpandedVaultIds((current) => new Set(current).add(vaultId));
      await loadVaultCredentials(vaultId);
    } catch (createError) {
      setVaultsError(errorMessage(createError));
      throw createError;
    } finally {
      setVaultSaving(false);
    }
  }

  async function deleteVault(vaultId: string) {
    if (!auth) return;

    setVaultSaving(true);
    setVaultsError(null);
    try {
      await apiFetch<{ vault: unknown }>(`/vaults/${encodeURIComponent(vaultId)}`, auth, { method: "DELETE" });
      setCredentialsByVault((current) => {
        const next = { ...current };
        delete next[vaultId];
        return next;
      });
      setExpandedVaultIds((current) => {
        const next = new Set(current);
        next.delete(vaultId);
        return next;
      });
      await loadVaults();
    } catch (deleteError) {
      setVaultsError(errorMessage(deleteError));
      throw deleteError;
    } finally {
      setVaultSaving(false);
    }
  }

  async function deleteVaultCredential(vaultId: string, credentialId: string) {
    if (!auth) return;

    setVaultsError(null);
    try {
      await apiFetch<{ credential: unknown }>(`/vaults/${encodeURIComponent(vaultId)}/credentials/${encodeURIComponent(credentialId)}`, auth, { method: "DELETE" });
      await loadVaultCredentials(vaultId);
    } catch (deleteError) {
      setVaultsError(errorMessage(deleteError));
    }
  }

  const currentWorkspaceRole = auth ? (members.find((member) => member.uuid === auth.uuid)?.role ?? auth.role ?? "member") : "member";

  if (authLoading) {
    return (
      <main className="signin-shell" style={themedStyle}>
        <section className="signin-panel">
          <Loader2 className="spin" size={24} aria-hidden="true" />
          <p className="signin-tagline">Opening local canvas</p>
        </section>
      </main>
    );
  }

  if (!auth) {
    return <SignInView onAuth={handleAuth} />;
  }

  return (
    <main className="app-shell projects-shell" style={themedStyle}>
      <div className="project-window">
      <section className="workspace">
        <div className="workspace-inner">
            <ProjectsView
              projects={projects}
              selectedProjectId={selectedProjectId}
              localSettingsReady={localSettingsReady}
              canvasViewports={canvasViewports}
              agents={projectAgents}
              mcpServers={visibleMcpServers}
              skills={visibleSkills}
              apiKeys={projectApiKeys}
              emailReceivers={projectEmailReceivers}
              integrations={integrations}
              environments={environments}
              environmentLoading={environmentLoading}
              environmentSaving={environmentSaving}
              vaults={runtimeVaults}
              vaultsLoading={vaultsLoading}
              vaultSaving={vaultSaving}
              selectedVaultIds={selectedProjectVaultIds}
              selectedVaultCredentials={selectedProjectVaultId ? (credentialsByVault[selectedProjectVaultId] ?? []) : []}
              selectedVaultCredentialsLoading={selectedProjectVaultId ? credentialsLoadingByVault[selectedProjectVaultId] === true : false}
              sessions={sessions}
              sessionsLoading={sessionsLoading}
              stoppingSessionId={stoppingSessionId}
              skillsLoading={skillsLoading}
              skillSaving={skillSaving}
              apiKeySaving={apiKeySaving}
              emailReceiverSaving={emailReceiverSaving}
              currentUserId={auth.uuid}
              loading={projectsLoading}
              error={projectsError}
              projectSaving={projectSaving}
              onSave={(project) => {
                void saveProject(project);
              }}
              onCanvasViewportChange={storeCanvasViewport}
              onCreate={() => {
                setProjectCreateOpen(true);
              }}
              onSelectProject={setSelectedProjectId}
              onSubAgentEdgeChange={(agentId, subAgentId, enabled) => {
                void updateAgentSubAgent(agentId, subAgentId, enabled);
              }}
              onMcpEdgeChange={(agentId, mcpServerId, enabled) => {
                void updateAgentMcp(agentId, mcpServerId, enabled);
              }}
              onSkillEdgeChange={(agentId, skillId, enabled) => {
                void updateAgentSkill(agentId, skillId, enabled);
              }}
              onCreateScheduledDeployment={(project, graph, scheduleNode, agentNode) => createScheduledDeploymentFromCanvas(project, graph, scheduleNode, agentNode)}
              onDeleteScheduledDeployment={(deploymentId) => {
                void deleteDeployment(deploymentId);
              }}
              onRunPlay={(agentIds, prompt, nodeParams, triggerNodeId) => runCanvasPlay(agentIds, prompt, nodeParams, triggerNodeId)}
              onLoadSessionMessages={loadSessionMessages}
              onRefreshSessions={loadSessions}
              onSendSessionMessage={sendTriggerSessionMessage}
              onStopSession={stopChatSession}
              onCreateAgent={(position) => {
                if (createOpen) {
                  setCreateOpen(false);
                  setCreateAgentPlacement(null);
                  return;
                }
                setCreateAgentPlacement(position ? { projectId: selectedProjectId, ...position } : null);
                setCreateOpen(true);
              }}
              onCreateMcpServer={() => setMcpServerCreateOpen(true)}
              onCreateSkill={createSkill}
              onCreateApiKey={createApiKey}
              onCreateEmailReceiver={createEmailReceiver}
              onRotateApiKey={(apiKey) => rotateApiKey(apiKey, false)}
              onOpenAgent={setSelectedAgent}
              onOpenMcpServer={setSelectedMcpServer}
              onOpenMcpInstall={(server) => {
                setMcpServerToInstall(server);
                setIntegrationToInstall(null);
                setIntegrationInstallOpen(true);
              }}
              onOpenSkill={setSelectedSkill}
              onOpenIntegrationInstall={(integration) => {
                setMcpServerToInstall(null);
                setIntegrationToInstall(integration);
                setIntegrationInstallOpen(true);
              }}
              onOpenSettings={() => {
                setProjectSettingsPageOpen(true);
              }}
              onOpenIntegrationLibrary={() => {
                setIntegrationToInstall(null);
                setMcpServerToInstall(null);
                setIntegrationInstallOpen(true);
              }}
              onOpenReview={() => setCanvasReviewOpen(true)}
              onCreateProjectEnvironment={createAndSelectProjectEnvironment}
              onCreateProjectVault={createAndSelectProjectVault}
              onSignOut={() => setConfirmSignOutOpen(true)}
              createdAgentPlacement={createdCanvasAgentPlacement}
              onCreatedAgentPlacementConsumed={() => setCreatedCanvasAgentPlacement(null)}
            />
        </div>
      </section>
      </div>

      {projectSettingsPageOpen && selectedProject ? (
        <Modal title="Project settings" onClose={() => setProjectSettingsPageOpen(false)} plainHeader>
          <ProjectSettingsView
            project={selectedProject}
            environments={environments}
            vaults={vaults}
            credentialsByVault={credentialsByVault}
            credentialsLoadingByVault={credentialsLoadingByVault}
            saving={projectSaving}
            environmentSaving={environmentSaving}
            vaultSaving={vaultSaving}
            error={projectsError}
            onSave={saveProject}
            onUpdateEnvironment={updateEnvironment}
            onCreateEnvironment={createAndSelectProjectEnvironment}
            onDeleteEnvironment={deleteEnvironment}
            onLoadVaultCredentials={loadVaultCredentials}
            onCreateVault={createAndSelectProjectVault}
            onDeleteVault={deleteVault}
            onDeleteVaultCredential={deleteVaultCredential}
            onDelete={(project) => {
              void deleteProject(project);
              setProjectSettingsPageOpen(false);
            }}
          />
        </Modal>
      ) : null}

      {createOpen && createAgentProject ? (
        <CreateAgentDialog
          auth={auth}
          projectId={createAgentProject.id}
          projects={projects}
          agents={agents}
          registeredMcpServers={createAgentProjectMcpServers}
          projectCanEdit
          workspaceRole={currentWorkspaceRole}
          onClose={() => {
            setCreateOpen(false);
            setFirstAgentProjectId(null);
            setCreateAgentPlacement(null);
          }}
          onCreated={(agent) => {
            void handleCreated(agent);
          }}
          side={!projectSettingsPageOpen}
        />
      ) : null}

      {projectCreateOpen ? (
        <CreateProjectDialog
          saving={projectSaving}
          onClose={() => setProjectCreateOpen(false)}
          onCreate={async (name) => {
            const project = await createProject(name);
            setProjectCreateOpen(false);
            setFirstAgentProjectId(project.id);
          }}
        />
      ) : null}

      {mcpServerCreateOpen ? (
        <CreateMcpServerDialog
          projects={projects}
          selectedProjectId={selectedProject?.id ?? null}
          saving={mcpServerSaving}
          onClose={() => setMcpServerCreateOpen(false)}
          side={!projectSettingsPageOpen}
          onSubmit={async (payload) => {
            await createMcpServer(payload);
            setMcpServerCreateOpen(false);
          }}
        />
      ) : null}

      {apiKeyCreateOpen ? (
        <CreateApiKeyDialog
          saving={apiKeySaving}
          onClose={() => setApiKeyCreateOpen(false)}
          onCreate={async (name) => {
            await createApiKey(name);
            setApiKeyCreateOpen(false);
          }}
        />
      ) : null}

      {selectedMcpServer ? (
        <CreateMcpServerDialog
          server={selectedMcpServer}
          projects={projects}
          selectedProjectId={selectedProject?.id ?? null}
          saving={mcpServerSaving}
          onClose={() => setSelectedMcpServer(null)}
          side={!projectSettingsPageOpen}
          onSubmit={async (payload) => {
            await updateMcpServer(selectedMcpServer.id, payload);
            setSelectedMcpServer(null);
          }}
        />
      ) : null}

      {selectedSkill ? (
        <SkillDetailsDialog
          skill={selectedSkill}
          saving={skillSaving}
          onClose={() => setSelectedSkill(null)}
          onSaveMetadata={(payload) => updateSkillMetadata(selectedSkill.id, payload)}
          onCreateVersion={(payload) => createSkillVersion(selectedSkill.id, payload)}
          projects={projects}
          selectedProjectId={selectedProject?.id ?? null}
        />
      ) : null}

      {integrationCreateOpen ? <IntegrationDialog onClose={() => setIntegrationCreateOpen(false)} onSave={async (payload) => { await saveIntegration(payload); setIntegrationCreateOpen(false); }} /> : null}
      {selectedIntegration ? <IntegrationDialog integration={selectedIntegration} onClose={() => setSelectedIntegration(null)} onSave={(payload) => saveIntegration(payload, selectedIntegration)} onDelete={() => removeIntegration(selectedIntegration)} /> : null}
      {packagePresetCreateOpen ? <PackagePresetDialog onClose={() => setPackagePresetCreateOpen(false)} onSave={async (payload) => { await savePackagePreset(payload); setPackagePresetCreateOpen(false); }} /> : null}
      {selectedPackagePreset ? <PackagePresetDialog packagePreset={selectedPackagePreset} onClose={() => setSelectedPackagePreset(null)} onSave={(payload) => savePackagePreset(payload, selectedPackagePreset)} onDelete={() => removePackagePreset(selectedPackagePreset)} /> : null}
      {tutorialCreateOpen ? <TutorialDialog onClose={() => setTutorialCreateOpen(false)} onSave={async (payload) => { await saveTutorial(payload); setTutorialCreateOpen(false); }} /> : null}
      {selectedTutorial ? <TutorialDialog tutorial={selectedTutorial} onClose={() => setSelectedTutorial(null)} onSave={(payload) => saveTutorial(payload, selectedTutorial)} onDelete={() => removeTutorial(selectedTutorial)} /> : null}
      {integrationInstallOpen && selectedProject ? (
        <IntegrationInstallDialog
          tutorials={tutorials}
          packagePresets={packagePresets}
          mcpServers={visibleMcpServers}
          projectId={selectedProject.id}
          selectedVaultId={selectedProjectVaultId}
          selectedVaultCredentials={selectedProjectVaultId ? (credentialsByVault[selectedProjectVaultId] ?? []) : []}
          selectedVaultCredentialsLoading={selectedProjectVaultId ? credentialsLoadingByVault[selectedProjectVaultId] === true : false}
          projectEnvironment={environmentForProject(selectedProject, environments)}
          initialMcpServer={mcpServerToInstall ?? (integrationToInstall ? mcpServerFromIntegrationTemplate(integrationToInstall) : null)}
          onClose={() => {
            setIntegrationInstallOpen(false);
            setIntegrationToInstall(null);
            setMcpServerToInstall(null);
          }}
          onInstallMcpServer={installProjectMcpServer}
          onInstallPackage={installProjectPackage}
        />
      ) : null}
      {canvasReviewOpen && selectedProject ? (
        <CanvasReviewDialog
          project={selectedProject}
          saving={projectSaving}
          mcpServers={visibleMcpServers}
          integrations={integrations}
          onClose={() => setCanvasReviewOpen(false)}
          onReview={reviewCanvas}
          onApply={applyCanvasReviewActions}
          onOpenIntegration={(integration) => {
            setCanvasReviewOpen(false);
            setMcpServerToInstall(null);
            setIntegrationToInstall(integration);
            setIntegrationInstallOpen(true);
          }}
        />
      ) : null}

      {confirmSignOutOpen ? (
        <ConfirmDialog
          title="Sign out"
          message="Sign out and clear the local Anthropic proxy session?"
          confirmLabel="Sign out"
          onCancel={() => setConfirmSignOutOpen(false)}
          onConfirm={() => {
            setConfirmSignOutOpen(false);
            signOut();
          }}
        />
      ) : null}

      {revealedApiKey ? <ApiKeyRevealToast revealedApiKey={revealedApiKey} onClose={() => setRevealedApiKey(null)} /> : null}

      {environmentCreateOpen ? (
        <EnvironmentDialog
          saving={environmentSaving}
          onClose={() => setEnvironmentCreateOpen(false)}
          onSubmit={async (payload) => {
            await createEnvironment(payload);
            setEnvironmentCreateOpen(false);
          }}
        />
      ) : null}

      {selectedEnvironment ? (
        <EnvironmentDialog
          environment={selectedEnvironment}
          saving={environmentSaving}
          onClose={() => setSelectedEnvironment(null)}
          onSubmit={async (payload) => {
            await updateEnvironment(selectedEnvironment.id, payload);
            setSelectedEnvironment(null);
          }}
        />
      ) : null}

      {deploymentCreateOpen ? (
        <CreateDeploymentDialog
          agents={agents}
          environments={environments}
          vaults={runtimeVaults}
          saving={deploymentSaving}
          onClose={() => setDeploymentCreateOpen(false)}
          onCreate={async (payload) => {
            await createDeployment(payload);
            setDeploymentCreateOpen(false);
          }}
        />
      ) : null}

      {vaultCreateOpen ? (
        <CreateVaultDialog
          saving={vaultSaving}
          onClose={() => setVaultCreateOpen(false)}
          onCreate={async (payload) => {
            await createVault(payload);
            setVaultCreateOpen(false);
          }}
        />
      ) : null}

      {secretCreateVault ? (
        <CreateSecretDialog
          vault={secretCreateVault}
          saving={vaultSaving}
          onClose={() => setSecretCreateVault(null)}
          onCreate={async (payload) => {
            await createVaultCredential(secretCreateVault.id, payload);
            setSecretCreateVault(null);
          }}
        />
      ) : null}

      {selectedAgent ? (
        <AgentDetailsDialog
          record={selectedAgent}
          auth={auth}
          agents={agents}
          members={members}
          registeredMcpServers={selectedAgentMcpServers}
          projectCanEdit={
            agentProjectIdsFromMetadata(selectedAgent.agent.metadata).some((projectId) =>
              canEditProject(projects.find((project) => project.id === projectId) ?? ({ current_user_role: "viewer" } as ProjectRecord)),
            )
          }
          projects={projects}
          selectedProjectId={selectedProject?.id ?? null}
          workspaceRole={currentWorkspaceRole}
          onClose={() => setSelectedAgent(null)}
          onChanged={handleChanged}
          side={!projectSettingsPageOpen}
        />
      ) : null}
      {selectedDeployment ? (
        <DeploymentDetailsDialog
          deployment={selectedDeployment}
          agents={agents}
          environments={environments}
          vaults={runtimeVaults}
          saving={deploymentSaving}
          onClose={() => setSelectedDeployment(null)}
          onUpdate={(payload) => updateDeployment(selectedDeployment.id, payload)}
          onDelete={() => deleteDeployment(selectedDeployment.id)}
        />
      ) : null}
    </main>
  );
}

function SignInView({ onAuth }: { onAuth: (auth: AuthSession, apiKey: string) => Promise<void> }) {
  const [apiKey, setApiKey] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) return;
    setSaving(true);
    setError(null);
    try {
      const nextAuth = await createAnthropicProxySession<AuthSession>(trimmedKey);
      await onAuth(nextAuth, trimmedKey);
    } catch (authError) {
      await clearLocalAuthStorage();
      setError(errorMessage(authError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="signin-shell" style={themedStyle}>
      <section className="signin-panel local-key-panel">
        <div className="signin-heading">
          <div className="signin-logo local-key-logo" aria-hidden="true">
            <KeyRound size={22} />
          </div>
          <div className="signin-title-copy">
            <h1>Raddus Canvas</h1>
          </div>
        </div>
        <p className="signin-tagline">Enter a valid Anthropic API Key. Your key is securely stored on this device.</p>
        <form className="local-key-form" onSubmit={submit}>
          <div className="local-key-input-wrap">
            <input
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              type="password"
              placeholder="sk-ant-api..."
              aria-label="Anthropic API key"
              autoComplete="off"
              spellCheck={false}
              required
            />
            <span className="local-key-input-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </div>
          {error ? <div className="notice error">{error}</div> : null}
          <button className="primary-button" type="submit" disabled={saving || !apiKey.trim()}>
            {saving ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <KeyRound size={16} aria-hidden="true" />}
            Continue
          </button>
        </form>
      </section>
    </main>
  );
}

function ProjectsView({
  projects,
  selectedProjectId,
  localSettingsReady,
  canvasViewports,
  agents,
  mcpServers,
  skills,
  apiKeys,
  emailReceivers,
  integrations,
  environments,
  environmentLoading,
  environmentSaving,
  vaults,
  vaultsLoading,
  vaultSaving,
  selectedVaultIds,
  selectedVaultCredentials,
  selectedVaultCredentialsLoading,
  sessions,
  sessionsLoading,
  stoppingSessionId,
  skillsLoading,
  skillSaving,
  apiKeySaving,
  emailReceiverSaving,
  currentUserId,
  loading,
  error,
  projectSaving,
  onSave,
  onCanvasViewportChange,
  onCreate,
  onSelectProject,
  onSubAgentEdgeChange,
  onMcpEdgeChange,
  onSkillEdgeChange,
  onCreateScheduledDeployment,
  onDeleteScheduledDeployment,
  onRunPlay,
  onLoadSessionMessages,
  onRefreshSessions,
  onSendSessionMessage,
  onStopSession,
  onCreateAgent,
  onCreateMcpServer,
  onCreateSkill,
  onCreateApiKey,
  onCreateEmailReceiver,
  onRotateApiKey,
  onOpenAgent,
  onOpenMcpServer,
  onOpenMcpInstall,
  onOpenSkill,
  onOpenIntegrationInstall,
  onOpenSettings,
  onOpenIntegrationLibrary,
  onOpenReview,
  onCreateProjectEnvironment,
  onCreateProjectVault,
  onSignOut,
  createdAgentPlacement,
  onCreatedAgentPlacementConsumed,
}: {
  projects: ProjectRecord[];
  selectedProjectId: string;
  localSettingsReady: boolean;
  canvasViewports: CanvasViewportsByProject;
  agents: AgentRecord[];
  mcpServers: RegisteredMcpServer[];
  skills: SkillRecord[];
  apiKeys: ApiKeyRecord[];
  emailReceivers: EmailReceiverRecord[];
  integrations: IntegrationRecord[];
  environments: AnthropicEnvironment[];
  environmentLoading: boolean;
  environmentSaving: boolean;
  vaults: VaultRecord[];
  vaultsLoading: boolean;
  vaultSaving: boolean;
  selectedVaultIds: string[];
  selectedVaultCredentials: VaultCredential[];
  selectedVaultCredentialsLoading: boolean;
  sessions: ManagedSession[];
  sessionsLoading: boolean;
  stoppingSessionId: string | null;
  skillsLoading: boolean;
  skillSaving: boolean;
  apiKeySaving: boolean;
  emailReceiverSaving: boolean;
  currentUserId: string;
  loading: boolean;
  error: string | null;
  projectSaving: boolean;
  onSave: (project: ProjectRecord) => void;
  onCanvasViewportChange: (projectId: string, viewport: CanvasViewport) => void;
  onCreate: () => void;
  onSelectProject: (projectId: string) => void;
  onSubAgentEdgeChange: (agentId: string, subAgentId: string, enabled: boolean) => void;
  onMcpEdgeChange: (agentId: string, mcpServerId: string, enabled: boolean) => void;
  onSkillEdgeChange: (agentId: string, skillId: string, enabled: boolean) => void;
  onCreateScheduledDeployment: (project: ProjectRecord, graph: ProjectGraph, scheduleNode: ProjectNode, agentNode: ProjectNode) => Promise<string | null>;
  onDeleteScheduledDeployment: (deploymentId: string) => void;
  onRunPlay: (agentIds: string[], prompt: string, nodeParams: JsonObject, triggerNodeId: string) => Promise<string[]>;
  onLoadSessionMessages: (sessionId: string) => Promise<ChatMessage[]>;
  onRefreshSessions: () => Promise<void>;
  onSendSessionMessage: (session: ManagedSession, message: string) => Promise<void>;
  onStopSession: (session: ManagedSession) => Promise<void>;
  onCreateAgent: (position?: { x: number; y: number }) => void;
  onCreateMcpServer: () => void;
  onCreateSkill: (payload: { name: string; description: string; files: File[]; publicUrl: string; projectIds: string[] }) => Promise<void>;
  onCreateApiKey: (name: string) => Promise<{ apiKey: ApiKeyRecord; key: string } | null>;
  onCreateEmailReceiver: (name: string) => Promise<{ emailReceiver: EmailReceiverRecord } | null>;
  onRotateApiKey: (apiKey: ApiKeyRecord) => Promise<{ apiKey: ApiKeyRecord; key: string } | null>;
  onOpenAgent: (record: AgentRecord) => void;
  onOpenMcpServer: (server: RegisteredMcpServer) => void;
  onOpenMcpInstall: (server: RegisteredMcpServer) => void;
  onOpenSkill: (skill: SkillRecord) => void;
  onOpenIntegrationInstall: (integration: IntegrationRecord) => void;
  onOpenSettings: () => void;
  onOpenIntegrationLibrary: () => void;
  onOpenReview: () => void;
  onCreateProjectEnvironment: (project: ProjectRecord, payload?: JsonObject) => Promise<AnthropicEnvironment | null>;
  onCreateProjectVault: (project: ProjectRecord, payload?: { display_name?: string; vault_ids?: string[] }) => Promise<VaultRecord | null>;
  onSignOut: () => void;
  createdAgentPlacement: { projectId: string; agentId: string; x: number; y: number; nonce: number } | null;
  onCreatedAgentPlacementConsumed: () => void;
}) {
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null;
  const [draft, setDraft] = React.useState<ProjectRecord | null>(selectedProject);
  const [draggingNodeId, setDraggingNodeId] = React.useState<string | null>(null);
  const [connectingFromId, setConnectingFromId] = React.useState<string | null>(null);
  const [lastPaletteTab, setLastPaletteTab] = React.useState<PaletteTab>("triggers");
  const [palette, setPalette] = React.useState<{ x: number; y: number; tab: PaletteTab } | null>(null);
  const [camera, setCamera] = React.useState<CanvasViewport>(defaultCanvasViewport);
  const [playPanelNodeId, setPlayPanelNodeId] = React.useState<string | null>(null);
  const [selectedPlaySessionId, setSelectedPlaySessionId] = React.useState("");
  const [playSessionMessages, setPlaySessionMessages] = React.useState<ChatMessage[]>([]);
  const [playSessionLoading, setPlaySessionLoading] = React.useState(false);
  const [playSessionError, setPlaySessionError] = React.useState<string | null>(null);
  const [statusBySessionId, setStatusBySessionId] = React.useState<Record<string, ParsedSessionStatusUpdate | null>>({});
  const [runningPlayNodeId, setRunningPlayNodeId] = React.useState<string | null>(null);
  const [apiKeyCreateNodeId, setApiKeyCreateNodeId] = React.useState<string | null>(null);
  const [emailReceiverCreateNodeId, setEmailReceiverCreateNodeId] = React.useState<string | null>(null);
  const [apiInfoNodeId, setApiInfoNodeId] = React.useState<string | null>(null);
  const [skillCreateOpen, setSkillCreateOpen] = React.useState(false);
  const [canvasHelpOpen, setCanvasHelpOpen] = React.useState(false);
  const [canvasActionStackOpen, setCanvasActionStackOpen] = React.useState(false);
  const canvasRef = React.useRef<HTMLDivElement | null>(null);
  const connectionPreviewPathRef = React.useRef<SVGPathElement | null>(null);
  const cameraRef = React.useRef(camera);
  const cameraFrameRef = React.useRef<number | null>(null);
  const cameraSaveTimeoutRef = React.useRef<number | null>(null);
  const pendingCameraSaveRef = React.useRef<{ projectId: string; viewport: CanvasViewport } | null>(null);
  const restoredCameraProjectIdRef = React.useRef<string | null>(null);
  const lastStoredCameraRef = React.useRef<{ projectId: string; viewport: CanvasViewport } | null>(null);
  const suppressNodeClickRef = React.useRef(false);
  const lastSavedProjectShapeRef = React.useRef<string>("");
  const draftProjectIdRef = React.useRef<string | null>(selectedProject?.id ?? null);

  React.useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  React.useEffect(() => {
    if (!localSettingsReady) return;
    const projectId = selectedProject?.id ?? null;
    if (!projectId) {
      flushCameraSave();
      restoredCameraProjectIdRef.current = null;
      lastStoredCameraRef.current = null;
      cameraRef.current = defaultCanvasViewport;
      setCamera(defaultCanvasViewport);
      return;
    }
    if (restoredCameraProjectIdRef.current === projectId) return;
    flushCameraSave();
    const restoredViewport = canvasViewports[projectId] ?? defaultCanvasViewport;
    restoredCameraProjectIdRef.current = projectId;
    lastStoredCameraRef.current = { projectId, viewport: restoredViewport };
    cameraRef.current = restoredViewport;
    setCamera(restoredViewport);
  }, [canvasViewports, localSettingsReady, selectedProject?.id]);

  React.useEffect(() => {
    if (!localSettingsReady || !selectedProject?.id) return;
    queueCameraSave(selectedProject.id, camera);
  }, [camera, localSettingsReady, selectedProject?.id]);

  React.useEffect(() => {
    function flushBeforeUnload() {
      flushCameraSave();
    }
    window.addEventListener("beforeunload", flushBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", flushBeforeUnload);
      flushCameraSave();
    };
  }, []);

  React.useEffect(() => {
    const nextProjectId = selectedProject?.id ?? null;
    if (draftProjectIdRef.current !== nextProjectId) {
      draftProjectIdRef.current = nextProjectId;
      setDraft(selectedProject ? cloneProject(selectedProject) : null);
    } else if (selectedProject) {
      setDraft((current) => {
        if (!current || current.id !== selectedProject.id) return current;
        if (
          current.name === selectedProject.name &&
          (current.anthropic_environment_id ?? null) === (selectedProject.anthropic_environment_id ?? null) &&
          (current.anthropic_vault_id ?? null) === (selectedProject.anthropic_vault_id ?? null) &&
          stringArraysEqual(projectVaultIds(current, []), projectVaultIds(selectedProject, []))
        ) return current;
        return {
          ...current,
          name: selectedProject.name,
          anthropic_environment_id: selectedProject.anthropic_environment_id ?? null,
          anthropic_vault_id: selectedProject.anthropic_vault_id ?? null,
          vault_ids: projectVaultIds(selectedProject, []),
        };
      });
    }
    lastSavedProjectShapeRef.current = selectedProject ? JSON.stringify(projectEditableShape(selectedProject)) : "";
  }, [selectedProject]);

  React.useEffect(() => {
    if (!selectedProject) return;
    setDraft((current) => {
      if (!current || current.id !== selectedProject.id) return current;
      let changed = false;
      const nodes = current.graph.nodes.map((node) => {
        const storedNode = selectedProject.graph.nodes.find((item) => item.id === node.id);
        const sessionIds = [...new Set([...(node.session_ids ?? []), ...(storedNode?.session_ids ?? [])])];
        if (sessionIds.length === (node.session_ids?.length ?? 0)) return node;
        changed = true;
        return { ...node, session_ids: sessionIds };
      });
      return changed ? { ...current, graph: { ...current.graph, nodes } } : current;
    });
  }, [selectedProject]);

  const graph = draft?.graph ?? createDefaultProjectGraph();
  const canEditCurrentProject = draft ? canEditProject(draft) : false;
  const sessionsById = React.useMemo(() => new Map(sessions.map((session) => [session.id, session])), [sessions]);
  const projectEnvironment = selectedProject ? environmentForProject(selectedProject, environments) : null;
  const vaultSetupMissing = !vaultsLoading && vaults.length === 0;
  const environmentSetupMissing = !environmentLoading && environments.length === 0;
  const setupWarningText = environmentSetupMissing && vaultSetupMissing
    ? "Create an environment and vault to finish setup."
    : environmentSetupMissing
      ? "Create an environment to run agents."
      : vaultSetupMissing
        ? "Create a vault to store secrets."
        : "";

  function fixMissingSetup() {
    if (!draft) return;
    void (async () => {
      let projectForSetup = draft;
      if (environmentSetupMissing) {
        const environment = await onCreateProjectEnvironment(projectForSetup);
        if (environment) projectForSetup = { ...projectForSetup, anthropic_environment_id: environment.id };
      }
      if (vaultSetupMissing) {
        await onCreateProjectVault(projectForSetup);
      }
    })().catch(() => undefined);
  }

  React.useEffect(() => {
    const triggerNodes = graph.nodes.filter((node) => ["play", "schedule", "slack", "api", "email"].includes(node.type));
    const sessionIds = [...new Set(triggerNodes.flatMap((node) =>
      connectedAgentIdsForTrigger(node.id).flatMap((agentId) => {
        const session = sessionsForTrigger(node.id).find((candidate) => candidate.agent.id === agentId);
        return session ? [session.id] : [];
      }),
    ))];
    if (sessionIds.length === 0) {
      setStatusBySessionId((current) => (Object.keys(current).length === 0 ? current : {}));
      return;
    }
    let cancelled = false;
    void Promise.all(sessionIds.map(async (sessionId) => {
      const updates = parseSessionMessageStatusUpdates(await onLoadSessionMessages(sessionId));
      return [sessionId, updates.at(-1) ?? null] as const;
    })).then((entries) => {
      if (!cancelled) setStatusBySessionId(Object.fromEntries(entries));
    }).catch(() => {
      if (!cancelled) setStatusBySessionId({});
    });
    return () => { cancelled = true; };
  }, [graph.nodes, graph.edges, sessions, onLoadSessionMessages]);

  React.useEffect(() => {
    if (!draft || !canEditCurrentProject) return;
    const shape = JSON.stringify(projectEditableShape(draft));
    if (!lastSavedProjectShapeRef.current || shape === lastSavedProjectShapeRef.current) return;
    const timeout = window.setTimeout(() => {
      lastSavedProjectShapeRef.current = shape;
      onSave(draft);
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [canEditCurrentProject, draft, onSave]);

  const ownedApiKeys = React.useMemo(() => apiKeys.filter((apiKey) => apiKey.creator_uuid === currentUserId), [apiKeys, currentUserId]);

  function updateDraft(updater: (current: ProjectRecord) => ProjectRecord) {
    if (!canEditCurrentProject) return;
    setDraft((current) => (current ? updater(current) : current));
  }

  React.useEffect(() => {
    if (!createdAgentPlacement) return;
    const agentExists = agents.some((record) => record.id === createdAgentPlacement.agentId);
    if (!agentExists) return;

    setDraft((current) => {
      if (!canEditCurrentProject) return current;
      if (!current || current.id !== createdAgentPlacement.projectId) return current;
      if (current.graph.nodes.some((node) => node.type === "agent" && node.agent_id === createdAgentPlacement.agentId)) return current;

      const nodeId = crypto.randomUUID();
      return {
        ...current,
        graph: syncProjectGraphAgentDependencies(
          {
            ...current.graph,
            nodes: [
              ...current.graph.nodes,
              {
                id: nodeId,
                type: "agent",
                agent_id: createdAgentPlacement.agentId,
                x: createdAgentPlacement.x,
                y: createdAgentPlacement.y,
              },
            ],
          },
          agents,
          mcpServers,
        ),
      };
    });
    onCreatedAgentPlacementConsumed();
  }, [agents, canEditCurrentProject, createdAgentPlacement, mcpServers, onCreatedAgentPlacementConsumed]);

  function screenToWorld(clientX: number, clientY: number, viewCamera = cameraRef.current): { x: number; y: number } {
    const canvas = canvasRef.current;
    if (!canvas) return { x: clientX, y: clientY };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - viewCamera.x) / viewCamera.zoom,
      y: (clientY - rect.top - viewCamera.y) / viewCamera.zoom,
    };
  }

  function canvasCenterToWorld(): { x: number; y: number } | undefined {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const rect = canvas.getBoundingClientRect();
    return screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  function scheduleCamera(nextCamera: CanvasViewport) {
    cameraRef.current = nextCamera;
    if (cameraFrameRef.current !== null) return;
    cameraFrameRef.current = window.requestAnimationFrame(() => {
      cameraFrameRef.current = null;
      setCamera(cameraRef.current);
    });
  }

  function queueCameraSave(projectId: string, viewport: CanvasViewport) {
    const normalized = normalizeCanvasViewport(viewport);
    if (!normalized) return;
    const lastStored = lastStoredCameraRef.current;
    if (lastStored?.projectId === projectId && canvasViewportsEqual(lastStored.viewport, normalized)) {
      if (pendingCameraSaveRef.current?.projectId === projectId) {
        pendingCameraSaveRef.current = null;
        if (cameraSaveTimeoutRef.current !== null) {
          window.clearTimeout(cameraSaveTimeoutRef.current);
          cameraSaveTimeoutRef.current = null;
        }
      }
      return;
    }
    pendingCameraSaveRef.current = { projectId, viewport: normalized };
    if (cameraSaveTimeoutRef.current !== null) window.clearTimeout(cameraSaveTimeoutRef.current);
    cameraSaveTimeoutRef.current = window.setTimeout(() => {
      flushCameraSave();
    }, 350);
  }

  function flushCameraSave() {
    if (cameraSaveTimeoutRef.current !== null) {
      window.clearTimeout(cameraSaveTimeoutRef.current);
      cameraSaveTimeoutRef.current = null;
    }
    const pending = pendingCameraSaveRef.current;
    if (!pending) return;
    pendingCameraSaveRef.current = null;
    const lastStored = lastStoredCameraRef.current;
    if (lastStored?.projectId === pending.projectId && canvasViewportsEqual(lastStored.viewport, pending.viewport)) return;
    lastStoredCameraRef.current = pending;
    onCanvasViewportChange(pending.projectId, pending.viewport);
  }

  function moveNode(nodeId: string, x: number, y: number) {
    updateDraft((current) => ({
      ...current,
      graph: {
        ...current.graph,
        nodes: current.graph.nodes.map((node) => (node.id === nodeId ? { ...node, x, y } : node)),
      },
    }));
  }

  function addAgentAt(agentId: string, x: number, y: number) {
    if (!agentId) return;
    const nodeId = crypto.randomUUID();
    updateDraft((current) => ({
      ...current,
      graph: syncProjectGraphAgentDependencies(
        {
          ...current.graph,
          nodes: [...current.graph.nodes, { id: nodeId, type: "agent", agent_id: agentId, x, y }],
        },
        agents,
        mcpServers,
      ),
    }));
    setPalette(null);
  }

  function addMcpAt(mcpServerId: string, x: number, y: number) {
    if (!mcpServerId) return;
    updateDraft((current) => ({
      ...current,
      graph: {
        ...current.graph,
        nodes: [...current.graph.nodes, { id: crypto.randomUUID(), type: "mcp", mcp_server_id: mcpServerId, x, y }],
      },
    }));
    setPalette(null);
  }

  function addSkillAt(skillId: string, x: number, y: number) {
    if (!skillId) return;
    updateDraft((current) => ({
      ...current,
      graph: {
        ...current.graph,
        nodes: [...current.graph.nodes, { id: crypto.randomUUID(), type: "skill", skill_id: skillId, x, y }],
      },
    }));
    setPalette(null);
  }

  function addPlayAt(x: number, y: number) {
    updateDraft((current) => ({
      ...current,
      graph: {
        ...current.graph,
        nodes: [...current.graph.nodes, { id: crypto.randomUUID(), type: "play", x, y }],
      },
    }));
    setPalette(null);
  }

  function addScheduleAt(x: number, y: number) {
    const nodeId = crypto.randomUUID();
    updateDraft((current) => ({
      ...current,
      graph: {
        nodes: [
          ...current.graph.nodes,
          {
            id: nodeId,
            type: "schedule",
            x,
            y,
            schedule: createDefaultScheduleDraft(),
          },
        ],
        edges: current.graph.edges,
      },
    }));
    setPalette(null);
  }

  function addSlackAt(x: number, y: number) {
    updateDraft((current) => ({
      ...current,
      graph: {
        ...current.graph,
        nodes: [
          ...current.graph.nodes,
          {
            id: crypto.randomUUID(),
            type: "slack",
            x,
            y,
            slack_trigger: createDefaultSlackTriggerDraft(),
          },
        ],
      },
    }));
    setPalette(null);
  }

  function addApiAt(x: number, y: number) {
    updateDraft((current) => ({
      ...current,
      graph: {
        ...current.graph,
        nodes: [
          ...current.graph.nodes,
          {
            id: crypto.randomUUID(),
            type: "api",
            x,
            y,
            api_trigger: createDefaultApiTriggerDraft(ownedApiKeys),
          },
        ],
      },
    }));
    setPalette(null);
  }

  function addEmailAt(x: number, y: number) {
    updateDraft((current) => ({
      ...current,
      graph: {
        ...current.graph,
        nodes: [
          ...current.graph.nodes,
          {
            id: crypto.randomUUID(),
            type: "email",
            x,
            y,
            email_trigger: createDefaultEmailTriggerDraft(emailReceivers),
          },
        ],
      },
    }));
    setPalette(null);
  }

  function openAgentCreate() {
    if (!canEditCurrentProject) return;
    const position = palette ? { x: palette.x, y: palette.y } : undefined;
    setPalette(null);
    onCreateAgent(position);
  }

  function openAgentCreateAtCanvasCenter() {
    if (!canEditCurrentProject) return;
    setPalette(null);
    onCreateAgent(canvasCenterToWorld());
  }

  function openMcpServerCreate() {
    if (!canEditCurrentProject) return;
    setPalette(null);
    onCreateMcpServer();
  }

  function openSkillCreate() {
    if (!canEditCurrentProject) return;
    setPalette(null);
    setSkillCreateOpen(true);
  }

  function openAgentDetails(record: AgentRecord) {
    setPalette(null);
    onOpenAgent(record);
  }

  function openMcpServerDetails(server: RegisteredMcpServer) {
    setPalette(null);
    onOpenMcpServer(server);
  }

  function openSettingsPage() {
    setPalette(null);
    onOpenSettings();
  }

  function removeNode(nodeId: string) {
    graph.edges.filter((edge) => edge.source === nodeId || edge.target === nodeId).forEach((edge) => handleEdgeRemoved(edge));
    updateDraft((current) => ({
      ...current,
      graph: {
        nodes: current.graph.nodes.filter((node) => node.id !== nodeId),
        edges: current.graph.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
      },
    }));
  }

  function removeEdge(edgeId: string) {
    const edge = graph.edges.find((item) => item.id === edgeId);
    if (edge) handleEdgeRemoved(edge);
    updateDraft((current) => ({
      ...current,
      graph: {
        ...current.graph,
        edges: current.graph.edges.filter((edge) => edge.id !== edgeId),
      },
    }));
  }

  function updateSchedule(nodeId: string, schedule: ScheduleDraft) {
    updateDraft((current) => ({
      ...current,
      graph: {
        ...current.graph,
        nodes: current.graph.nodes.map((node) => (node.id === nodeId ? { ...node, schedule } : node)),
      },
    }));
  }

  function updateSlackTrigger(nodeId: string, slackTrigger: SlackTriggerDraft) {
    updateDraft((current) => ({
      ...current,
      graph: {
        ...current.graph,
        nodes: current.graph.nodes.map((node) => (node.id === nodeId ? { ...node, slack_trigger: slackTrigger } : node)),
      },
    }));
  }

  function updateApiTrigger(nodeId: string, apiTrigger: ApiTriggerDraft) {
    updateDraft((current) => ({
      ...current,
      graph: {
        ...current.graph,
        nodes: current.graph.nodes.map((node) => (node.id === nodeId ? { ...node, api_trigger: apiTrigger } : node)),
      },
    }));
  }

  function updateEmailTrigger(nodeId: string, emailTrigger: EmailTriggerDraft) {
    updateDraft((current) => ({
      ...current,
      graph: {
        ...current.graph,
        nodes: current.graph.nodes.map((node) => (node.id === nodeId ? { ...node, email_trigger: emailTrigger } : node)),
      },
    }));
  }

  async function rotateApiKeyForNode(node: ProjectNode) {
    const apiKey = ownedApiKeys.find((key) => key.id === node.api_trigger?.api_key_id);
    if (!apiKey) return;
    await onRotateApiKey(apiKey);
  }

  async function createApiKeyForNode(name: string) {
    if (!apiKeyCreateNodeId) return;
    const response = await onCreateApiKey(name);
    if (response) {
      updateApiTrigger(apiKeyCreateNodeId, { api_key_id: response.apiKey.id });
    }
    setApiKeyCreateNodeId(null);
  }

  async function createEmailReceiverForNode(name: string) {
    if (!emailReceiverCreateNodeId) return;
    const response = await onCreateEmailReceiver(name);
    if (response) {
      updateEmailTrigger(emailReceiverCreateNodeId, { receiver_id: response.emailReceiver.id });
    }
    setEmailReceiverCreateNodeId(null);
  }

  function updatePlayPrompt(nodeId: string, prompt: string) {
    updateDraft((current) => ({
      ...current,
      graph: {
        ...current.graph,
        nodes: current.graph.nodes.map((node) => (node.id === nodeId ? { ...node, prompt } : node)),
      },
    }));
  }

  function connectedAgentIdsForTrigger(nodeId: string, sourceGraph = graph): string[] {
    return sourceGraph.edges
      .filter((edge) => edge.source === nodeId && (edge.type === "runs" || edge.type === "schedules" || edge.type === "slack_triggers" || edge.type === "api_triggers" || edge.type === "email_triggers"))
      .map((edge) => sourceGraph.nodes.find((node) => node.id === edge.target && node.type === "agent")?.agent_id)
      .filter((agentId): agentId is string => Boolean(agentId));
  }

  function statusForTriggerEdge(source: ProjectNode, target: ProjectNode): { status: ConnectionStatus; label: string; sessionId?: string } | null {
    if (!target.agent_id || !["play", "schedule", "slack", "api", "email"].includes(source.type)) return null;
    const sessionId = sessionsForTrigger(source.id).find((session) => session.agent.id === target.agent_id)?.id;
    const update = sessionId ? statusBySessionId[sessionId] : null;
    if (update) return { status: update.status, label: `${update.agent}: ${update.status} — ${update.message}`, sessionId };
    return {
      status: "idle",
      label: sessionId ? "This session has not emitted a status update yet" : "Idle — no sessions have been started from this trigger",
      sessionId,
    };
  }

  function sessionsForTrigger(nodeId: string): ManagedSession[] {
    const trigger = graph.nodes.find((node) => node.id === nodeId);
    const sessionIds = new Set(trigger?.session_ids ?? []);
    const connectedAgentIds = new Set(connectedAgentIdsForTrigger(nodeId));
    return latestSessionsFirst(sessions.filter((session) => sessionIds.has(session.id) || connectedAgentIds.has(session.agent.id)));
  }

  async function runPlay(node: ProjectNode) {
    if (!canEditCurrentProject) return;
    const agentIds = connectedAgentIdsForTrigger(node.id);
    if (agentIds.length === 0) {
      setPlaySessionError("Connect at least one agent to this play card.");
      setPlayPanelNodeId(node.id);
      return;
    }
    setRunningPlayNodeId(node.id);
    setPlaySessionError(null);
    const sessionIds = await onRunPlay(agentIds, node.prompt ?? "", {}, node.id);
    if (sessionIds.length > 0) {
      updateDraft((current) => ({
        ...current,
        graph: {
          ...current.graph,
          nodes: current.graph.nodes.map((item) => item.id === node.id
            ? { ...item, session_ids: [...new Set([...(item.session_ids ?? []), ...sessionIds])] }
            : item),
        },
      }));
    }
    setRunningPlayNodeId(null);
    setPlayPanelNodeId(node.id);
    if (sessionIds[0]) {
      await selectPlaySession(sessionIds[0]);
    }
  }

  async function selectPlaySession(sessionId: string) {
    if (!sessionId) {
      setSelectedPlaySessionId("");
      setPlaySessionMessages([]);
      return;
    }
    setSelectedPlaySessionId(sessionId);
    setPlaySessionLoading(true);
    setPlaySessionError(null);
    try {
      setPlaySessionMessages(await onLoadSessionMessages(sessionId));
    } catch (loadError) {
      setPlaySessionError(errorMessage(loadError));
    } finally {
      setPlaySessionLoading(false);
    }
  }

  async function sendPlaySessionMessage(message: string) {
    const session = sessionsById.get(selectedPlaySessionId);
    if (!session) throw new Error("Select a session before sending a message.");
    await onSendSessionMessage(session, message);
    await selectPlaySession(session.id);
  }

  async function stopPlaySession(session: ManagedSession) {
    await onStopSession(session);
    await selectPlaySession(session.id);
  }

  React.useEffect(() => {
    setDraft((current) => {
      if (!canEditCurrentProject) return current;
      if (!current) return current;
      const syncedGraph = syncProjectGraphAgentDependencies(current.graph, agents, mcpServers);
      if (JSON.stringify(syncedGraph) === JSON.stringify(current.graph)) return current;
      return { ...current, graph: syncedGraph };
    });
  }, [agents, canEditCurrentProject, mcpServers]);

  React.useEffect(() => {
    if (!draft || !canEditCurrentProject || canvasHelpOpen || apiInfoNodeId || apiKeyCreateNodeId || emailReceiverCreateNodeId) return;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, select, button, [contenteditable], [role='dialog']")
      ) {
        return;
      }
      if (event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        openAgentCreateAtCanvasCenter();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [apiInfoNodeId, apiKeyCreateNodeId, canEditCurrentProject, canvasHelpOpen, draft, emailReceiverCreateNodeId]);

  function pointerDown(event: React.PointerEvent, nodeId: string) {
    if (!canEditCurrentProject) return;
    if ((event.target as HTMLElement).closest("button, input, select, .project-connector")) return;
    const node = graph.nodes.find((item) => item.id === nodeId);
    if (!node) return;
    const startWorld = screenToWorld(event.clientX, event.clientY);
    const offsetX = startWorld.x - node.x;
    const offsetY = startWorld.y - node.y;
    const startX = event.clientX;
    const startY = event.clientY;
    suppressNodeClickRef.current = false;
    setDraggingNodeId(nodeId);
    event.currentTarget.setPointerCapture(event.pointerId);

    function onMove(moveEvent: PointerEvent) {
      if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 4) {
        suppressNodeClickRef.current = true;
      }
      const nextWorld = screenToWorld(moveEvent.clientX, moveEvent.clientY);
      moveNode(nodeId, nextWorld.x - offsetX, nextWorld.y - offsetY);
    }

    function onUp() {
      setDraggingNodeId(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function suppressesNodeClick(): boolean {
    if (!suppressNodeClickRef.current) return false;
    window.setTimeout(() => {
      suppressNodeClickRef.current = false;
    }, 0);
    return true;
  }

  function edgeTypeForCanvasConnection(source: ProjectNode, target: ProjectNode): ProjectEdgeType | null {
    const type = projectEdgeTypeFor(source, target);
    if (!type) return null;
    if ((type === "sub_agent" && isGlobalAgentNode(source, agents)) || ((type === "uses_mcp" || type === "uses_skill") && isGlobalAgentNode(target, agents))) {
      return null;
    }
    if (type === "uses_mcp") {
      const mcpAlreadyConnected = graph.edges.some((edge) => edge.source === source.id && edge.type === "uses_mcp" && edge.target !== target.id);
      if (mcpAlreadyConnected) return null;
      const duplicateAgentMcp = source.mcp_server_id
        ? graph.edges.some((edge) => {
            if (edge.target !== target.id || edge.type !== "uses_mcp" || edge.source === source.id) return false;
            const existingMcp = graph.nodes.find((node) => node.id === edge.source);
            return existingMcp?.type === "mcp" && existingMcp.mcp_server_id === source.mcp_server_id;
          })
        : false;
      if (duplicateAgentMcp) return null;
    }
    return type;
  }

  function beginConnection(event: React.PointerEvent, nodeId: string) {
    if (!canEditCurrentProject) return;
    event.preventDefault();
    event.stopPropagation();
    setPalette(null);
    setConnectingFromId(nodeId);
    updateConnectionPreview(event.clientX, event.clientY);

    function updateConnectionPreview(clientX: number, clientY: number) {
      const source = graph.nodes.find((node) => node.id === nodeId);
      const path = connectionPreviewPathRef.current;
      if (!source || !path) return;
      path.setAttribute("d", connectionPreviewPath(source, screenToWorld(clientX, clientY)));
      path.style.display = "block";
    }

    function onMove(moveEvent: PointerEvent) {
      updateConnectionPreview(moveEvent.clientX, moveEvent.clientY);
    }

    function onUp(upEvent: PointerEvent) {
      const targetElement = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
      const targetNodeId = targetElement instanceof HTMLElement ? targetElement.closest<HTMLElement>("[data-project-node-id]")?.dataset.projectNodeId : undefined;
      if (targetNodeId && targetNodeId !== nodeId) connectNodes(nodeId, targetNodeId);
      setConnectingFromId(null);
      if (connectionPreviewPathRef.current) {
        connectionPreviewPathRef.current.style.display = "none";
        connectionPreviewPathRef.current.setAttribute("d", "");
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function connectNodes(sourceId: string, targetId: string) {
    if (!canEditCurrentProject) return;
    const source = graph.nodes.find((node) => node.id === sourceId);
    const target = graph.nodes.find((node) => node.id === targetId);
    if (!source || !target) return;
    const type = edgeTypeForCanvasConnection(source, target);
    if (!type) return;
    const exists = graph.edges.some((edge) => edge.source === sourceId && edge.target === targetId && edge.type === type);
    if (exists) return;
    const newEdge: ProjectEdge = { id: crypto.randomUUID(), source: sourceId, target: targetId, type };
    const nextGraph = {
      ...graph,
      edges: [...graph.edges, newEdge],
    };
    updateDraft((current) => {
      return {
        ...current,
        graph: nextGraph,
      };
    });
    void handleEdgeAdded(newEdge, nextGraph);
  }

  async function handleEdgeAdded(edge: ProjectEdge, nextGraph: ProjectGraph) {
    const source = nextGraph.nodes.find((node) => node.id === edge.source);
    const target = nextGraph.nodes.find((node) => node.id === edge.target);
    if (!source || !target || !draft) return;

    if (edge.type === "sub_agent" && source.agent_id && target.agent_id) {
      onSubAgentEdgeChange(source.agent_id, target.agent_id, true);
      return;
    }

    if (edge.type === "uses_mcp" && source.mcp_server_id && target.agent_id) {
      onMcpEdgeChange(target.agent_id, source.mcp_server_id, true);
      return;
    }

    if (edge.type === "uses_skill" && source.skill_id && target.agent_id) {
      onSkillEdgeChange(target.agent_id, source.skill_id, true);
      return;
    }

    if (edge.type === "schedules" && source.type === "schedule" && target.type === "agent") {
      const deploymentId = await onCreateScheduledDeployment(draft, nextGraph, source, target);
      if (deploymentId) attachDeploymentToEdge(edge.id, deploymentId);
      return;
    }
  }

  function handleEdgeRemoved(edge: ProjectEdge) {
    const source = graph.nodes.find((node) => node.id === edge.source);
    const target = graph.nodes.find((node) => node.id === edge.target);
    if (!source || !target) return;

    if (edge.type === "sub_agent" && source.agent_id && target.agent_id) {
      onSubAgentEdgeChange(source.agent_id, target.agent_id, false);
      return;
    }

    if (edge.type === "uses_mcp" && source.mcp_server_id && target.agent_id) {
      onMcpEdgeChange(target.agent_id, source.mcp_server_id, false);
      return;
    }

    if (edge.type === "uses_skill" && source.skill_id && target.agent_id) {
      onSkillEdgeChange(target.agent_id, source.skill_id, false);
      return;
    }

    if (edge.type === "schedules" && edge.deployment_id) {
      onDeleteScheduledDeployment(edge.deployment_id);
      return;
    }

    if (edge.type === "runs") {
      const scheduleEdges = graph.edges.filter((item) => item.target === edge.source && item.type === "schedules" && item.deployment_id);
      scheduleEdges.forEach((scheduleEdge) => onDeleteScheduledDeployment(scheduleEdge.deployment_id as string));
      const scheduleEdgeIds = new Set(scheduleEdges.map((item) => item.id));
      if (scheduleEdgeIds.size > 0) {
        updateDraft((current) =>
          current
            ? {
                ...current,
                graph: {
                  ...current.graph,
                  edges: current.graph.edges.map((item) => (scheduleEdgeIds.has(item.id) ? { ...item, deployment_id: undefined } : item)),
                },
              }
            : current,
        );
      }
    }
  }

  function attachDeploymentToEdge(edgeId: string, deploymentId: string) {
    updateDraft((current) =>
      current
        ? {
            ...current,
            graph: {
              ...current.graph,
              edges: current.graph.edges.map((edge) => (edge.id === edgeId ? { ...edge, deployment_id: deploymentId } : edge)),
            },
          }
        : current,
    );
  }

  function handleCanvasPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest(".project-node, .project-controls-overlay, .project-workspace-overlay, .project-card-palette")) return;
    if (canEditCurrentProject && event.metaKey) {
      const point = screenToWorld(event.clientX, event.clientY);
      setPalette({
        x: point.x,
        y: point.y,
        tab: lastPaletteTab,
      });
      return;
    }

    setPalette(null);
    const startX = event.clientX;
    const startY = event.clientY;
    const startCamera = cameraRef.current;

    function onMove(moveEvent: PointerEvent) {
      scheduleCamera({
        ...startCamera,
        x: startCamera.x + moveEvent.clientX - startX,
        y: startCamera.y + moveEvent.clientY - startY,
      });
    }

    function onUp() {
      flushCameraSave();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function handleCanvasWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    if (event.metaKey || event.ctrlKey) {
      const zoomFactor = Math.exp(-event.deltaY * 0.001);
      const current = cameraRef.current;
      const nextZoom = Math.min(2.2, Math.max(0.35, current.zoom * zoomFactor));
      const worldPoint = screenToWorld(event.clientX, event.clientY, current);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      scheduleCamera({
        x: event.clientX - rect.left - worldPoint.x * nextZoom,
        y: event.clientY - rect.top - worldPoint.y * nextZoom,
        zoom: nextZoom,
      });
      return;
    }

    const current = cameraRef.current;
    scheduleCamera({
      ...current,
      x: current.x - event.deltaX,
      y: current.y - event.deltaY,
    });
  }

  return (
    <section className="projects-view">
      {loading && projects.length === 0 ? (
        <div className="empty-state">
          <Loader2 className="spin" size={24} aria-hidden="true" />
          <span>Loading projects</span>
        </div>
      ) : !draft ? (
        <div className="empty-state">
          <Play size={28} aria-hidden="true" />
          <strong>No projects found</strong>
          <span>Create a project to compose agents visually.</span>
          <button className="primary-button" type="button" onClick={onCreate}>
            <Plus size={16} aria-hidden="true" />
            New project
          </button>
          <button className="secondary-button" type="button" onClick={onSignOut}>
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </div>
      ) : (
        <>
          <div
            className={`project-canvas ${connectingFromId ? "connecting" : ""}`}
            ref={canvasRef}
            onPointerDown={handleCanvasPointerDown}
            onWheel={handleCanvasWheel}
          >
            <div className="grid-field" aria-hidden="true" />
            <div className="project-controls-overlay">
              <div className="canvas-control-group project-select-group">
                <select
                  className="project-select"
                  value={draft.id}
                  onChange={(event) => onSelectProject(event.target.value)}
                  onPointerDown={(event) => event.stopPropagation()}
                  aria-label="Project"
                >
                  {projects.map((project) => (
                    <option value={project.id} key={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <button className="icon-button" type="button" onClick={onCreate} disabled={projectSaving} title="Create project" aria-label="Create project">
                  {projectSaving ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                </button>
              </div>
              <div className="canvas-control-group project-agent-actions">
                <button className="icon-button" type="button" onClick={onOpenReview} title="Review canvas" aria-label="Review canvas">
                  <ClipboardCheck size={18} aria-hidden="true" />
                </button>
                <button className="icon-button" type="button" onClick={onOpenIntegrationLibrary} title="Integrations" aria-label="Integrations">
                  <Puzzle size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
            {setupWarningText ? (
              <div className="setup-warning-label" onPointerDown={(event) => event.stopPropagation()}>
                <TriangleAlert size={16} aria-hidden="true" />
                <span>{setupWarningText}</span>
                <button
                  className="secondary-button compact-button"
                  type="button"
                  onClick={fixMissingSetup}
                  disabled={!canEditCurrentProject || projectSaving || environmentSaving || vaultSaving}
                >
                  {environmentSaving || vaultSaving || projectSaving ? <Loader2 className="spin" size={14} aria-hidden="true" /> : null}
                  Fix
                </button>
              </div>
            ) : null}
            <div className={canvasActionStackOpen ? "project-workspace-overlay expanded" : "project-workspace-overlay"}>
              <button
                className="icon-button project-workspace-button project-workspace-menu-button"
                type="button"
                onClick={() => setCanvasActionStackOpen((open) => !open)}
                title={canvasActionStackOpen ? "Collapse menu" : "Expand menu"}
                aria-label={canvasActionStackOpen ? "Collapse menu" : "Expand menu"}
                aria-expanded={canvasActionStackOpen}
                aria-controls="canvas-action-stack"
              >
                <Menu size={18} aria-hidden="true" />
              </button>
              <div className="project-workspace-actions" id="canvas-action-stack" hidden={!canvasActionStackOpen}>
                <button className="secondary-button project-workspace-button canvas-action-button" type="button" onClick={openSettingsPage}>
                  <Settings size={18} aria-hidden="true" />
                  Project settings
                </button>
                <button className="secondary-button project-workspace-button canvas-action-button" type="button" onClick={() => setCanvasHelpOpen(true)}>
                  <Info size={18} aria-hidden="true" />
                  Canvas controls
                </button>
                <button className="secondary-button project-workspace-button canvas-action-button" type="button" onClick={onSignOut}>
                  <LogOut size={18} aria-hidden="true" />
                  Sign out
                </button>
              </div>
            </div>

            {error ? <div className="project-error-overlay notice error">{error}</div> : null}

            <div className="project-world" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}>
              <svg className="project-edges" aria-hidden="true">
                {graph.edges.map((edge) => {
                  const source = graph.nodes.find((node) => node.id === edge.source);
                  const target = graph.nodes.find((node) => node.id === edge.target);
                  if (!source || !target) return null;
                  const path = edgePath(source, target);
                  const status = statusForTriggerEdge(source, target);
                  const statusPoint = edgeStatusPoint(source, target);
                  return (
                    <g key={edge.id}>
                      <path
                        className="project-edge-hit"
                        d={path}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!canEditCurrentProject) return;
                          removeEdge(edge.id);
                        }}
                      />
                      <path className={`project-edge ${edge.type}`} d={path} />
                      {status ? (
                        <g
                          className={`project-edge-status ${status.status}`}
                          transform={`translate(${statusPoint.x} ${statusPoint.y})`}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            setPalette(null);
                            setPlayPanelNodeId(source.id);
                            if (status.sessionId) void selectPlaySession(status.sessionId);
                          }}
                        >
                          <title>{status.label}</title>
                          <circle r="13" />
                          <ConnectionStatusIcon status={status.status} />
                        </g>
                      ) : null}
                    </g>
                  );
                })}
                <path className="project-edge-preview" ref={connectionPreviewPathRef} style={{ display: "none" }} />
              </svg>

              {graph.nodes.map((node) => {
                const connectingFrom = connectingFromId ? graph.nodes.find((item) => item.id === connectingFromId) : undefined;
                const connectionState =
                  connectingFrom && connectingFrom.id === node.id
                    ? "source"
                    : connectingFrom
                      ? edgeTypeForCanvasConnection(connectingFrom, node)
                        ? "valid"
                        : "invalid"
                      : "idle";
                const mcpServer = node.mcp_server_id ? mcpServers.find((server) => server.id === node.mcp_server_id) : undefined;
                const mcpInstallStatus = node.type === "mcp" && mcpServer
                  ? canvasMcpInstallStatus(mcpServer, selectedVaultIds[0] ?? "", selectedVaultCredentials, selectedVaultCredentialsLoading)
                  : "installed";
                return (
                  <ProjectNodeCard
                    key={node.id}
                    node={node}
                    agents={agents}
                    mcpServers={mcpServers}
                    skills={skills}
                    apiKeys={ownedApiKeys}
                    emailReceivers={emailReceivers}
                    environments={environments}
                    dragging={draggingNodeId === node.id}
                    connectionState={connectionState}
                    onPointerDown={(event) => pointerDown(event, node.id)}
                    onConnectorPointerDown={(event) => beginConnection(event, node.id)}
                    onRemove={() => removeNode(node.id)}
                    onScheduleChange={(schedule) => updateSchedule(node.id, schedule)}
                    onSlackTriggerChange={(slackTrigger) => updateSlackTrigger(node.id, slackTrigger)}
                    onApiTriggerChange={(apiTrigger) => updateApiTrigger(node.id, apiTrigger)}
                    onEmailTriggerChange={(emailTrigger) => updateEmailTrigger(node.id, emailTrigger)}
                    onRotateApiKey={() => {
                      void rotateApiKeyForNode(node);
                    }}
                    onCreateApiKey={() => setApiKeyCreateNodeId(node.id)}
                    onCreateEmailReceiver={() => setEmailReceiverCreateNodeId(node.id)}
                    onOpenApiInfo={() => setApiInfoNodeId(node.id)}
                    onPlayPromptChange={(prompt) => updatePlayPrompt(node.id, prompt)}
                    onRunPlay={() => void runPlay(node)}
                    onOpenPlay={() => {
                      setPalette(null);
                      setPlayPanelNodeId(node.id);
                      const availableSessions = sessionsForTrigger(node.id);
                      if (availableSessions[0]) void selectPlaySession(availableSessions[0].id);
                    }}
                    onOpenAgent={openAgentDetails}
                    onOpenMcpServer={openMcpServerDetails}
                    onOpenMcpInstall={onOpenMcpInstall}
                    onOpenSkill={onOpenSkill}
                    mcpInstallStatus={mcpInstallStatus}
                    runningPlay={runningPlayNodeId === node.id}
                    readOnly={!canEditCurrentProject}
                    shouldSuppressClick={suppressesNodeClick}
                  />
                );
              })}

              {palette && canEditCurrentProject ? (
                <ProjectCardPalette
                  palette={palette}
                  agents={agents}
                  mcpServers={mcpServers}
                  skills={skills}
                  skillsLoading={skillsLoading}
                  onTabChange={(tab) => {
                    setLastPaletteTab(tab);
                    setPalette((current) => (current ? { ...current, tab } : current));
                  }}
                  onAddPlay={() => addPlayAt(palette.x, palette.y)}
                  onAddSchedule={() => addScheduleAt(palette.x, palette.y)}
                  onAddApi={() => addApiAt(palette.x, palette.y)}
                  onAddAgent={(agentId) => addAgentAt(agentId, palette.x, palette.y)}
                  onAddMcp={(mcpServerId) => addMcpAt(mcpServerId, palette.x, palette.y)}
                  onAddSkill={(skillId) => addSkillAt(skillId, palette.x, palette.y)}
                  onCreateAgent={openAgentCreate}
                  onCreateMcpServer={openMcpServerCreate}
                  onCreateSkill={openSkillCreate}
                  onClose={() => setPalette(null)}
                />
              ) : null}
            </div>
          </div>

          {playPanelNodeId ? (
            <PlaySessionsPanel
              sessions={sessionsForTrigger(playPanelNodeId)}
              sessionsLoading={sessionsLoading}
              selectedSessionId={selectedPlaySessionId}
              messages={playSessionMessages}
              loading={playSessionLoading}
              error={playSessionError}
              stoppingSessionId={stoppingSessionId}
              onSelect={(sessionId) => void selectPlaySession(sessionId)}
              onRefresh={onRefreshSessions}
              onSend={(message) => sendPlaySessionMessage(message)}
              onStop={(session) => stopPlaySession(session)}
              onClose={() => {
                setPlayPanelNodeId(null);
                setSelectedPlaySessionId("");
                setPlaySessionMessages([]);
                setPlaySessionError(null);
              }}
            />
          ) : null}

          {apiKeyCreateNodeId ? (
            <CreateApiKeyDialog
              saving={apiKeySaving}
              side
              onClose={() => setApiKeyCreateNodeId(null)}
              onCreate={createApiKeyForNode}
            />
          ) : null}

          {emailReceiverCreateNodeId ? (
            <CreateEmailReceiverDialog
              saving={emailReceiverSaving}
              side
              onClose={() => setEmailReceiverCreateNodeId(null)}
              onCreate={createEmailReceiverForNode}
            />
          ) : null}

          {skillCreateOpen ? (
            <CreateSkillDialog
              projects={projects}
              selectedProjectId={selectedProjectId}
              saving={skillSaving}
              onClose={() => setSkillCreateOpen(false)}
              onCreate={async (payload) => {
                await onCreateSkill(payload);
                setSkillCreateOpen(false);
              }}
            />
          ) : null}

          {apiInfoNodeId ? (
            <ApiTriggerInfoDialog
              agentId={connectedAgentIdsForTrigger(apiInfoNodeId)[0] ?? ""}
              environmentId={projectEnvironment?.id ?? environments[0]?.id ?? ""}
              vaultIds={selectedVaultIds}
              onClose={() => setApiInfoNodeId(null)}
            />
          ) : null}

          {canvasHelpOpen ? <CanvasHelpDialog onClose={() => setCanvasHelpOpen(false)} /> : null}
        </>
      )}
    </section>
  );
}

function ProjectNodeCard({
  node,
  agents,
  mcpServers,
  skills,
  apiKeys,
  emailReceivers,
  environments,
  dragging,
  connectionState,
  onPointerDown,
  onConnectorPointerDown,
  onRemove,
  onScheduleChange,
  onSlackTriggerChange,
  onApiTriggerChange,
  onEmailTriggerChange,
  onRotateApiKey,
  onCreateApiKey,
  onCreateEmailReceiver,
  onOpenApiInfo,
  onPlayPromptChange,
  onRunPlay,
  onOpenPlay,
  onOpenAgent,
  onOpenMcpServer,
  onOpenMcpInstall,
  onOpenSkill,
  mcpInstallStatus,
  runningPlay,
  readOnly,
  shouldSuppressClick,
}: {
  node: ProjectNode;
  agents: AgentRecord[];
  mcpServers: RegisteredMcpServer[];
  skills: SkillRecord[];
  apiKeys: ApiKeyRecord[];
  emailReceivers: EmailReceiverRecord[];
  environments: AnthropicEnvironment[];
  dragging: boolean;
  connectionState: "idle" | "source" | "valid" | "invalid";
  onPointerDown: (event: React.PointerEvent) => void;
  onConnectorPointerDown: (event: React.PointerEvent) => void;
  onRemove: () => void;
  onScheduleChange: (schedule: ScheduleDraft) => void;
  onSlackTriggerChange: (slackTrigger: SlackTriggerDraft) => void;
  onApiTriggerChange: (apiTrigger: ApiTriggerDraft) => void;
  onEmailTriggerChange: (emailTrigger: EmailTriggerDraft) => void;
  onRotateApiKey: () => void;
  onCreateApiKey: () => void;
  onCreateEmailReceiver: () => void;
  onOpenApiInfo: () => void;
  onPlayPromptChange: (prompt: string) => void;
  onRunPlay: () => void;
  onOpenPlay: () => void;
  onOpenAgent: (record: AgentRecord) => void;
  onOpenMcpServer: (server: RegisteredMcpServer) => void;
  onOpenMcpInstall: (server: RegisteredMcpServer) => void;
  onOpenSkill: (skill: SkillRecord) => void;
  mcpInstallStatus: "installed" | "missing" | "loading";
  runningPlay: boolean;
  readOnly: boolean;
  shouldSuppressClick: () => boolean;
}) {
  const agent = node.agent_id ? agents.find((record) => record.id === node.agent_id) : undefined;
  const mcpServer = node.mcp_server_id ? mcpServers.find((server) => server.id === node.mcp_server_id) : undefined;
  const skill = node.skill_id ? skills.find((record) => record.id === node.skill_id) : undefined;
  const schedule = node.schedule ?? createDefaultScheduleDraft();
  const slackTrigger = node.slack_trigger ?? createDefaultSlackTriggerDraft();
  const apiTrigger = node.api_trigger ?? createDefaultApiTriggerDraft(apiKeys);
  const emailTrigger = node.email_trigger ?? createDefaultEmailTriggerDraft(emailReceivers);
  const mcpMissingInstall = node.type === "mcp" && mcpInstallStatus === "missing";
  const mcpName = mcpServer?.name ?? shortId(node.mcp_server_id ?? node.id);

  return (
    <article
      className={`project-node ${node.type} ${dragging ? "dragging" : ""} ${readOnly ? "readonly" : ""} ${mcpMissingInstall ? "mcp-install-missing" : ""} connect-${connectionState}`}
      style={{ left: node.x, top: node.y }}
      onPointerDown={onPointerDown}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button, input, select, textarea, .project-connector, .node-parameter-editor")) return;
        if (shouldSuppressClick()) return;
        if (node.type === "play" || node.type === "schedule" || node.type === "slack" || node.type === "api" || node.type === "email") {
          onOpenPlay();
          return;
        }
        if (node.type === "agent" && agent) {
          onOpenAgent(agent);
          return;
        }
        if (node.type === "mcp" && mcpServer) {
          if (mcpMissingInstall) {
            onOpenMcpInstall(mcpServer);
          } else {
            onOpenMcpServer(mcpServer);
          }
          return;
        }
        if (node.type === "skill" && skill) {
          onOpenSkill(skill);
        }
      }}
      data-project-node-id={node.id}
    >
      {node.type === "mcp" || node.type === "skill" ? (
        <div className="mcp-node-actions">
          {!readOnly ? <button className="project-connector" type="button" onPointerDown={onConnectorPointerDown} title="Drag to connect" aria-label="Drag to connect" /> : null}
          {!readOnly ? (
            <button className="icon-button compact-icon project-card-remove" type="button" onClick={onRemove} title="Remove card">
              <X size={12} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : (
        <div className="project-node-head">
          <span>{node.type === "play" ? "Play" : node.type === "schedule" ? "Schedule" : node.type === "slack" ? "Slack" : node.type === "api" ? "API" : node.type === "email" ? "Email" : "Agent"}</span>
          {!readOnly ? <button className="project-connector" type="button" onPointerDown={onConnectorPointerDown} title="Drag to connect" aria-label="Drag to connect" /> : null}
          {node.type === "api" ? (
            <button className="icon-button compact-icon project-card-info" type="button" onClick={onOpenApiInfo} title="API trigger help">
              <Info size={12} aria-hidden="true" />
            </button>
          ) : null}
          {!readOnly ? (
            <button className="icon-button compact-icon project-card-remove" type="button" onClick={onRemove} title="Remove card">
              <X size={12} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      )}

      {node.type === "play" ? (
        <div className="project-play-body">
          <input
            className="project-play-prompt"
            value={node.prompt ?? ""}
            onChange={(event) => onPlayPromptChange(event.target.value)}
            disabled={readOnly}
            placeholder="First prompt"
            onPointerDown={(event) => event.stopPropagation()}
          />
          <button
            className="project-play-button"
            type="button"
            title="Start sessions"
            onClick={(event) => {
              event.stopPropagation();
              onRunPlay();
            }}
            disabled={runningPlay || readOnly}
          >
            {runningPlay ? <Loader2 className="spin" size={20} aria-hidden="true" /> : <Play size={22} aria-hidden="true" />}
          </button>
        </div>
      ) : node.type === "agent" ? (
        <>
          <strong>{agent?.agent.name ?? shortId(node.agent_id ?? node.id)}</strong>
          {!agent ? <small>Missing agent</small> : null}
        </>
      ) : node.type === "mcp" ? (
        <div className="mcp-node-body" title={mcpName}>
          <div className="mcp-node-icon">
            <McpServerIcon server={mcpServer} fallbackSize={24} />
            {mcpMissingInstall ? (
              <span className="mcp-node-warning" title="Install this MCP credential in the selected project vault" aria-label="MCP credential missing">
                <TriangleAlert size={12} aria-hidden="true" />
              </span>
            ) : null}
          </div>
          <strong className="mcp-node-name">{mcpName}</strong>
        </div>
      ) : node.type === "skill" ? (
        <div className="skill-node-body" title={skill?.display_title ?? shortId(node.skill_id ?? node.id)}>
          <Sparkles size={18} aria-hidden="true" />
          <span>{skill?.display_title || shortId(node.skill_id ?? node.id)}</span>
        </div>
      ) : node.type === "slack" ? (
        <SlackTriggerMiniEditor slackTrigger={slackTrigger} onChange={onSlackTriggerChange} disabled={readOnly} />
      ) : node.type === "api" ? (
        <ApiTriggerMiniEditor apiTrigger={apiTrigger} apiKeys={apiKeys} onChange={onApiTriggerChange} onRotate={onRotateApiKey} onCreate={onCreateApiKey} onOpenInfo={onOpenApiInfo} disabled={readOnly} />
      ) : node.type === "email" ? (
        <EmailTriggerMiniEditor emailTrigger={emailTrigger} emailReceivers={emailReceivers} onChange={onEmailTriggerChange} onCreate={onCreateEmailReceiver} disabled={readOnly} />
      ) : (
        <ScheduleMiniEditor schedule={schedule} prompt={node.prompt ?? ""} onChange={onScheduleChange} onPromptChange={onPlayPromptChange} disabled={readOnly} />
      )}
    </article>
  );
}

function ProjectCardPalette({
  palette,
  agents,
  mcpServers,
  skills,
  skillsLoading,
  onTabChange,
  onAddPlay,
  onAddSchedule,
  onAddApi,
  onAddAgent,
  onAddMcp,
  onAddSkill,
  onCreateAgent,
  onCreateMcpServer,
  onCreateSkill,
  onClose,
}: {
  palette: { x: number; y: number; tab: PaletteTab };
  agents: AgentRecord[];
  mcpServers: RegisteredMcpServer[];
  skills: SkillRecord[];
  skillsLoading: boolean;
  onTabChange: (tab: PaletteTab) => void;
  onAddPlay: () => void;
  onAddSchedule: () => void;
  onAddApi: () => void;
  onAddAgent: (agentId: string) => void;
  onAddMcp: (mcpServerId: string) => void;
  onAddSkill: (skillId: string) => void;
  onCreateAgent: () => void;
  onCreateMcpServer: () => void;
  onCreateSkill: () => void;
  onClose: () => void;
}) {
  const builtInSkills = skills.filter((skill) => skill.source === "anthropic");
  const globalSkills = skills.filter((skill) => !skillIsBuiltIn(skill) && skillIsGlobal(skill));
  const projectSkills = skills.filter((skill) => !skillIsBuiltIn(skill) && !skillIsGlobal(skill));
  const [skillSectionsOpen, setSkillSectionsOpen] = React.useState(readPaletteSkillSections);

  function toggleSkillSection(section: "builtIn" | "global" | "project") {
    setSkillSectionsOpen((current) => {
      const next = { ...current, [section]: !current[section] };
      writePaletteSkillSections(next);
      return next;
    });
  }

  return (
    <div className="project-card-palette" style={{ left: palette.x, top: palette.y }} role="dialog" aria-label="Create project card" onWheel={(event) => event.stopPropagation()}>
      <div className="palette-tabs" role="tablist" aria-label="Card categories">
        <button className={palette.tab === "triggers" ? "active" : ""} type="button" onClick={() => onTabChange("triggers")}>
          Triggers
        </button>
        <button className={palette.tab === "agents" ? "active" : ""} type="button" onClick={() => onTabChange("agents")}>
          Agents
        </button>
        <button className={palette.tab === "mcps" ? "active" : ""} type="button" onClick={() => onTabChange("mcps")}>
          MCPs
        </button>
        <button className={palette.tab === "skills" ? "active" : ""} type="button" onClick={() => onTabChange("skills")}>
          Skills
        </button>
        <button className="icon-button compact-icon" type="button" onClick={onClose} title="Close">
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      {palette.tab === "triggers" ? (
        <div className="palette-list">
          <button type="button" onClick={onAddPlay}>
            <Play size={16} aria-hidden="true" />
            <span>
              <strong>Play</strong>
              <small>Main run card</small>
            </span>
          </button>
          <button type="button" onClick={onAddSchedule}>
            <Calendar size={16} aria-hidden="true" />
            <span>
              <strong>Schedule</strong>
              <small>Timed deployment trigger</small>
            </span>
          </button>
          <button type="button" onClick={onAddApi}>
            <KeyRound size={16} aria-hidden="true" />
            <span>
              <strong>API</strong>
              <small>Copy cURL helper</small>
            </span>
          </button>
        </div>
      ) : palette.tab === "agents" ? (
        <div className="palette-list">
          {agents.length === 0 ? <div className="palette-empty">No agents available</div> : null}
          {agents.map((record) => <PaletteAgentButton record={record} onAddAgent={onAddAgent} key={record.id} />)}
          <button className="palette-create-button" type="button" onClick={onCreateAgent}>
            <Plus size={16} aria-hidden="true" />
            Create new Agent
          </button>
        </div>
      ) : palette.tab === "mcps" ? (
        <div className="palette-list">
          {mcpServers.length === 0 ? <div className="palette-empty">No MCP servers available</div> : null}
          {mcpServers.map((server) => <PaletteMcpButton server={server} onAddMcp={onAddMcp} key={server.id} />)}
          <button className="palette-create-button" type="button" onClick={onCreateMcpServer}>
            <Plus size={16} aria-hidden="true" />
            Create new MCP
          </button>
        </div>
      ) : (
        <div className="palette-list">
          {skillsLoading ? (
            <div className="palette-empty">
              <Loader2 className="spin" size={15} aria-hidden="true" />
              Loading skills
            </div>
          ) : null}
          {!skillsLoading && skills.length === 0 ? <div className="palette-empty">No skills available</div> : null}
          <button className="palette-section-toggle" type="button" onClick={() => toggleSkillSection("builtIn")} aria-expanded={skillSectionsOpen.builtIn}>
            <span>Built-in</span>
            {skillSectionsOpen.builtIn ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
          </button>
          {skillSectionsOpen.builtIn ? (
            builtInSkills.length > 0 ? (
              builtInSkills.map((skill) => <PaletteSkillButton skill={skill} onAddSkill={onAddSkill} key={skill.id} />)
            ) : (
              <div className="palette-empty">No built-in skills</div>
            )
          ) : null}
          <button className="palette-section-toggle" type="button" onClick={() => toggleSkillSection("global")} aria-expanded={skillSectionsOpen.global}>
            <span>Global</span>
            {skillSectionsOpen.global ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
          </button>
          {skillSectionsOpen.global ? (
            globalSkills.length > 0 ? (
              globalSkills.map((skill) => <PaletteSkillButton skill={skill} onAddSkill={onAddSkill} key={skill.id} />)
            ) : (
              <div className="palette-empty">No global skills</div>
            )
          ) : null}
          <button className="palette-section-toggle" type="button" onClick={() => toggleSkillSection("project")} aria-expanded={skillSectionsOpen.project}>
            <span>In this project</span>
            {skillSectionsOpen.project ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
          </button>
          {skillSectionsOpen.project ? (
            projectSkills.length > 0 ? (
              projectSkills.map((skill) => <PaletteSkillButton skill={skill} onAddSkill={onAddSkill} key={skill.id} />)
            ) : (
              <div className="palette-empty">No project skills</div>
            )
          ) : null}
          <button className="palette-create-button" type="button" onClick={onCreateSkill}>
            <Plus size={16} aria-hidden="true" />
            Create new Skill
          </button>
        </div>
      )}
    </div>
  );
}

function PaletteMcpButton({ server, onAddMcp }: { server: RegisteredMcpServer; onAddMcp: (mcpServerId: string) => void }) {
  return (
    <button type="button" onClick={() => onAddMcp(server.id)} title={server.id}>
      <McpServerIcon className="palette-mcp-icon" server={server} fallbackSize={16} />
      <span>
        <strong>{server.name}</strong>
        <small>{server.description || "No description"}</small>
      </span>
    </button>
  );
}

function PaletteSkillButton({ skill, onAddSkill }: { skill: SkillRecord; onAddSkill: (skillId: string) => void }) {
  return (
    <button type="button" onClick={() => onAddSkill(skill.id)} title={skill.id}>
      <Sparkles size={16} aria-hidden="true" />
      <span>
        <strong>{skill.display_title || skill.id}</strong>
        <small>{skill.description?.trim() || "No description"}</small>
      </span>
    </button>
  );
}

function PaletteAgentButton({ record, onAddAgent }: { record: AgentRecord; onAddAgent: (agentId: string) => void }) {
  return (
    <button type="button" onClick={() => onAddAgent(record.id)}>
      <Bot size={16} aria-hidden="true" />
      <span>
        <strong>{record.agent.name}</strong>
        <small>{record.agent.description || "No description"}</small>
      </span>
    </button>
  );
}

function McpServerIcon({ server, fallbackSize, className }: { server: RegisteredMcpServer | undefined; fallbackSize: number; className?: string }) {
  return server?.icon_data_url ? <img className={className} src={server.icon_data_url} alt="" draggable={false} /> : <Server className={className} size={fallbackSize} aria-hidden="true" />;
}

function IntegrationsView({ integrations, loading, error, onRefresh, onCreate, onSelect }: { integrations: IntegrationRecord[]; loading: boolean; error: string | null; onRefresh: () => void; onCreate: () => void; onSelect: (integration: IntegrationRecord) => void }) {
  return <section className="mcp-servers-view"><header className="toolbar"><div><h1>Integrations</h1><p>{integrations.length} templates</p></div><div className="toolbar-actions"><button className="icon-button" type="button" onClick={onRefresh} disabled={loading} title="Refresh integrations">{loading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}</button><button className="primary-button" type="button" onClick={onCreate}><Plus size={17} /> Add</button></div></header>{error ? <div className="notice error">{error}</div> : null}{integrations.length === 0 ? <div className="empty-state"><Rocket size={28} /><strong>No integrations found</strong><span>Add integration templates for project editors to install.</span></div> : <div className="mcp-server-table" role="table"><div className="mcp-server-table-head" role="row"><span>Logo</span><span>Name</span><span>MCP URL</span><span>Auth</span><span>Agent</span><span>Updated</span></div>{integrations.map((integration) => <button className="mcp-server-row" type="button" role="row" onClick={() => onSelect(integration)} key={integration.id}><span className="mcp-server-icon-cell">{integration.logo_data_url ? <img src={integration.logo_data_url} alt="" /> : <Rocket size={20} />}</span><span className="agent-name-cell"><strong>{integration.name}</strong><small>{integration.description || integration.id}</small></span><span>{integration.mcp_server_url}</span><span className="owner-chip">{integration.mcp_auth_type === "static_bearer" ? "Static bearer" : "Environment variable"}</span><span className="agent-name-cell"><strong>{integration.agent_name}</strong><small>{integration.agent_model}</small></span><span className="numeric-cell">{formatDate(integration.updated_at)}</span></button>)}</div>}</section>;
}

function TutorialsView({ tutorials, loading, error, onRefresh, onCreate, onSelect }: { tutorials: TutorialRecord[]; loading: boolean; error: string | null; onRefresh: () => void; onCreate: () => void; onSelect: (tutorial: TutorialRecord) => void }) {
  return <section className="mcp-servers-view"><header className="toolbar"><div><h1>Tutorials</h1><p>{tutorials.length} available</p></div><div className="toolbar-actions"><button className="icon-button" type="button" onClick={onRefresh} disabled={loading} title="Refresh tutorials">{loading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}</button><button className="primary-button" type="button" onClick={onCreate}><Plus size={17} /> Add</button></div></header>{error ? <div className="notice error">{error}</div> : null}{tutorials.length === 0 ? <div className="empty-state"><FileText size={28} /><strong>No tutorials found</strong><span>Add Markdown tutorials for project editors to read while adding integrations.</span></div> : <div className="mcp-server-table" role="table"><div className="mcp-server-table-head tutorial-table-head" role="row"><span>Icon</span><span>Title</span><span>Description</span><span>Updated</span></div>{tutorials.map((tutorial) => <button className="mcp-server-row tutorial-row" type="button" role="row" onClick={() => onSelect(tutorial)} key={tutorial.id}><span className="mcp-server-icon-cell">{tutorial.logo_data_url ? <img src={tutorial.logo_data_url} alt="" /> : <FileText size={20} />}</span><span className="agent-name-cell"><strong>{tutorial.title}</strong><small>{tutorial.id}</small></span><span>{tutorial.description || "Markdown tutorial"}</span><span className="numeric-cell">{formatDate(tutorial.updated_at)}</span></button>)}</div>}</section>;
}

function PackagePresetsView({ packagePresets, loading, error, onRefresh, onCreate, onSelect }: { packagePresets: PackagePresetRecord[]; loading: boolean; error: string | null; onRefresh: () => void; onCreate: () => void; onSelect: (packagePreset: PackagePresetRecord) => void }) {
  return <section className="mcp-servers-view"><header className="toolbar"><div><h1>Package presets</h1><p>{packagePresets.length} available</p></div><div className="toolbar-actions"><button className="icon-button" type="button" onClick={onRefresh} disabled={loading} title="Refresh package presets">{loading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}</button><button className="primary-button" type="button" onClick={onCreate}><Plus size={17} /> Add</button></div></header>{error ? <div className="notice error">{error}</div> : null}{packagePresets.length === 0 ? <div className="empty-state"><Archive size={28} /><strong>No package presets found</strong><span>Add package presets for project editors to install into project environments.</span></div> : <div className="mcp-server-table" role="table"><div className="mcp-server-table-head tutorial-table-head" role="row"><span>Icon</span><span>Name</span><span>Package</span><span>Updated</span></div>{packagePresets.map((packagePreset) => <button className="mcp-server-row tutorial-row" type="button" role="row" onClick={() => onSelect(packagePreset)} key={packagePreset.id}><span className="mcp-server-icon-cell">{packagePreset.logo_data_url ? <img src={packagePreset.logo_data_url} alt="" /> : <Archive size={20} />}</span><span className="agent-name-cell"><strong>{packagePreset.name}</strong><small>{packagePreset.description || packageEnvSummary(packagePreset) || packagePreset.id}</small></span><span><span className="owner-chip">{packagePreset.target}</span> {packagePreset.package_name}</span><span className="numeric-cell">{formatDate(packagePreset.updated_at)}</span></button>)}</div>}</section>;
}

function IntegrationDialog({ integration, onClose, onSave, onDelete }: { integration?: IntegrationRecord; onClose: () => void; onSave: (value: Omit<IntegrationRecord, "id" | "created_at" | "updated_at">) => Promise<void>; onDelete?: () => Promise<void> }) {
  const [value, setValue] = React.useState({ name: integration?.name ?? "", description: integration?.description ?? "", logo_data_url: integration?.logo_data_url ?? null, mcp_server_url: integration?.mcp_server_url ?? "", mcp_auth_type: integration?.mcp_auth_type ?? "static_bearer" as IntegrationRecord["mcp_auth_type"], secret_help_url: integration?.secret_help_url ?? "", agent_name: integration?.agent_name ?? "", agent_description: integration?.agent_description ?? "", agent_system_prompt: integration?.agent_system_prompt ?? "", agent_model: integration?.agent_model ?? defaultAgentModel });
  const [error, setError] = React.useState<string | null>(null); const [saving, setSaving] = React.useState(false);
  async function selectLogo(file: File | undefined) { if (!file) return; try { setError(null); setValue({ ...value, logo_data_url: await readIconFile(file) }); } catch (logoError) { setError(errorMessage(logoError)); } }
  async function submit(event: React.FormEvent) { event.preventDefault(); setSaving(true); setError(null); try { await onSave({ ...value, description: value.description || null, secret_help_url: value.secret_help_url || null, agent_description: value.agent_description || null, agent_system_prompt: value.agent_system_prompt || null }); onClose(); } catch (saveError) { setError(errorMessage(saveError)); } finally { setSaving(false); } }
  return <Modal title={integration ? "Edit integration" : "Add integration"} onClose={onClose}><form className="form-grid" onSubmit={submit}><FormSection title="General info"><div className="icon-upload-field"><span>Logo image</span><div className="icon-upload-row"><div className="mcp-icon-preview" aria-label="Integration logo preview">{value.logo_data_url ? <img src={value.logo_data_url} alt="" /> : <Rocket size={24} aria-hidden="true" />}</div><label className="secondary-button compact-button"><Upload size={15} aria-hidden="true" />Upload<input className="visually-hidden-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" onChange={(event) => { void selectLogo(event.target.files?.[0]); event.target.value = ""; }} /></label>{value.logo_data_url ? <button className="secondary-button compact-button" type="button" onClick={() => setValue({ ...value, logo_data_url: null })}><X size={15} aria-hidden="true" />Remove</button> : null}</div></div><label><span>Name</span><input value={value.name} onChange={(e) => setValue({ ...value, name: e.target.value })} required /></label><label><span>Description</span><input value={value.description} onChange={(e) => setValue({ ...value, description: e.target.value })} /></label></FormSection><FormSection title="MCP server"><label><span>MCP server URL</span><input type="url" value={value.mcp_server_url} onChange={(e) => setValue({ ...value, mcp_server_url: e.target.value })} required /></label><label><span>Authentication</span><select value={value.mcp_auth_type} onChange={(e) => setValue({ ...value, mcp_auth_type: e.target.value as IntegrationRecord["mcp_auth_type"] })}><option value="static_bearer">Static bearer</option><option value="environment_variable">Environment variable</option></select></label><label><span>Secret help link</span><input type="url" value={value.secret_help_url ?? ""} onChange={(e) => setValue({ ...value, secret_help_url: e.target.value })} /></label></FormSection><FormSection title="Agent"><label><span>Name</span><input value={value.agent_name} onChange={(e) => setValue({ ...value, agent_name: e.target.value })} required /></label><label><span>Description</span><input value={value.agent_description ?? ""} onChange={(e) => setValue({ ...value, agent_description: e.target.value })} /></label><label><span>System prompt</span><textarea rows={5} value={value.agent_system_prompt ?? ""} onChange={(e) => setValue({ ...value, agent_system_prompt: e.target.value })} /></label><label><span>Model</span><AgentModelSelect value={value.agent_model} onChange={(agent_model) => setValue({ ...value, agent_model })} required /></label></FormSection>{error ? <div className="notice error">{error}</div> : null}<div className="dialog-actions">{onDelete ? <button className="danger-button" type="button" onClick={() => void onDelete()} disabled={saving}><Trash2 size={16} /> Delete</button> : null}<button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />} Save</button></div></form></Modal>;
}

function TutorialDialog({ tutorial, onClose, onSave, onDelete }: { tutorial?: TutorialRecord; onClose: () => void; onSave: (value: Omit<TutorialRecord, "id" | "created_at" | "updated_at">) => Promise<void>; onDelete?: () => Promise<void> }) {
  const [value, setValue] = React.useState({ title: tutorial?.title ?? "", description: tutorial?.description ?? "", logo_data_url: tutorial?.logo_data_url ?? null, markdown: tutorial?.markdown ?? "" });
  const [error, setError] = React.useState<string | null>(null); const [saving, setSaving] = React.useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setSaving(true); setError(null); try { await onSave({ ...value, description: value.description || null }); onClose(); } catch (saveError) { setError(errorMessage(saveError)); } finally { setSaving(false); } }
  return <Modal title={tutorial ? "Edit tutorial" : "Add tutorial"} onClose={onClose} wide><form className="form-grid" onSubmit={submit}><FormSection title="Tutorial"><label><span>Title</span><input value={value.title} onChange={(e) => setValue({ ...value, title: e.target.value })} required /></label><label><span>Description</span><input value={value.description} onChange={(e) => setValue({ ...value, description: e.target.value })} /></label><label><span>Markdown</span><textarea className="markdown-editor" rows={18} value={value.markdown} onChange={(e) => setValue({ ...value, markdown: e.target.value })} required /></label></FormSection>{error ? <div className="notice error">{error}</div> : null}<div className="dialog-actions">{onDelete ? <button className="danger-button" type="button" onClick={() => void onDelete()} disabled={saving}><Trash2 size={16} /> Delete</button> : null}<button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />} Save</button></div></form></Modal>;
}

function PackagePresetDialog({ packagePreset, onClose, onSave, onDelete }: { packagePreset?: PackagePresetRecord; onClose: () => void; onSave: (value: Omit<PackagePresetRecord, "id" | "created_at" | "updated_at">) => Promise<void>; onDelete?: () => Promise<void> }) {
  const [value, setValue] = React.useState({ name: packagePreset?.name ?? "", description: packagePreset?.description ?? "", logo_data_url: packagePreset?.logo_data_url ?? null, package_name: packagePreset?.package_name ?? "", target: packagePreset?.target ?? "pip" as PackageManager });
  const [environmentVariables, setEnvironmentVariables] = React.useState<Array<{ id: string; name: string }>>(
    (packagePreset?.environment_variables ?? []).map((name) => ({ id: crypto.randomUUID(), name })),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function selectLogo(file: File | undefined) {
    if (!file) return;
    try {
      setError(null);
      setValue({ ...value, logo_data_url: await readIconFile(file) });
    } catch (logoError) {
      setError(errorMessage(logoError));
    }
  }

  function updateEnvironmentVariable(id: string, name: string) {
    setEnvironmentVariables((current) => current.map((variable) => (variable.id === id ? { ...variable, name } : variable)));
  }

  function removeEnvironmentVariable(id: string) {
    setEnvironmentVariables((current) => current.filter((variable) => variable.id !== id));
  }

  function addEnvironmentVariable() {
    setEnvironmentVariables((current) => [...current, { id: crypto.randomUUID(), name: "" }]);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({
        ...value,
        description: value.description || null,
        environment_variables: environmentVariables.map((variable) => variable.name.trim()).filter(Boolean),
      });
      onClose();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={packagePreset ? "Edit package preset" : "Add package preset"} onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <FormSection title="Package">
          <div className="icon-upload-field">
            <span>Logo image</span>
            <div className="icon-upload-row">
              <div className="mcp-icon-preview" aria-label="Package logo preview">{value.logo_data_url ? <img src={value.logo_data_url} alt="" /> : <Archive size={24} aria-hidden="true" />}</div>
              <label className="secondary-button compact-button"><Upload size={15} aria-hidden="true" />Upload<input className="visually-hidden-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" onChange={(event) => { void selectLogo(event.target.files?.[0]); event.target.value = ""; }} /></label>
              {value.logo_data_url ? <button className="secondary-button compact-button" type="button" onClick={() => setValue({ ...value, logo_data_url: null })}><X size={15} aria-hidden="true" />Remove</button> : null}
            </div>
          </div>
          <label><span>Name</span><input value={value.name} onChange={(e) => setValue({ ...value, name: e.target.value })} required /></label>
          <label><span>Description</span><input value={value.description} onChange={(e) => setValue({ ...value, description: e.target.value })} /></label>
          <label><span>Package name</span><input value={value.package_name} onChange={(e) => setValue({ ...value, package_name: e.target.value })} placeholder="wrangler" required /></label>
          <label><span>Target</span><select value={value.target} onChange={(e) => setValue({ ...value, target: e.target.value as PackageManager })}>{packageManagers.map((manager) => <option value={manager} key={manager}>{manager}</option>)}</select></label>
        </FormSection>

        <FormSection title="Required environment values">
          <div className="structured-editor">
            <div className="structured-editor-head">
              <span>{environmentVariables.length} required</span>
              <button className="secondary-button compact-button" type="button" onClick={addEnvironmentVariable}>
                <Plus size={15} aria-hidden="true" />
                Add value
              </button>
            </div>
            {environmentVariables.length === 0 ? <div className="structured-empty">No required environment values</div> : null}
            {environmentVariables.map((variable) => (
              <div className="structured-row mcp-env-row" key={variable.id}>
                <label>
                  <span>Name</span>
                  <input value={variable.name} onChange={(event) => updateEnvironmentVariable(variable.id, event.target.value)} placeholder="API_KEY" required />
                </label>
                <button className="icon-button row-remove-button" type="button" onClick={() => removeEnvironmentVariable(variable.id)} title="Remove value">
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </FormSection>

        {error ? <div className="notice error">{error}</div> : null}
        <div className="dialog-actions">{onDelete ? <button className="danger-button" type="button" onClick={() => void onDelete()} disabled={saving}><Trash2 size={16} /> Delete</button> : null}<button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />} Save</button></div>
      </form>
    </Modal>
  );
}

function IntegrationInstallDialog({
  tutorials,
  packagePresets,
  mcpServers,
  projectId,
  selectedVaultId,
  selectedVaultCredentials,
  selectedVaultCredentialsLoading,
  projectEnvironment,
  initialMcpServer,
  onClose,
  onInstallMcpServer,
  onInstallPackage,
}: {
  tutorials: TutorialRecord[];
  packagePresets: PackagePresetRecord[];
  mcpServers: RegisteredMcpServer[];
  projectId: string;
  selectedVaultId: string;
  selectedVaultCredentials: VaultCredential[];
  selectedVaultCredentialsLoading: boolean;
  projectEnvironment: AnthropicEnvironment | null;
  initialMcpServer: RegisteredMcpServer | null;
  onClose: () => void;
  onInstallMcpServer: (server: RegisteredMcpServer, authPayload: JsonObject) => Promise<void>;
  onInstallPackage: (packagePreset: PackagePresetRecord, environmentValues: Record<string, string>) => Promise<void>;
}) {
  const [tab, setTab] = React.useState<"mcpServers" | "packages" | "tutorials">("mcpServers");
  const [selectedMcpServer, setSelectedMcpServer] = React.useState<RegisteredMcpServer | null>(initialMcpServer);
  const [selectedTutorial, setSelectedTutorial] = React.useState<TutorialRecord | null>(null);
  const [selectedPackagePreset, setSelectedPackagePreset] = React.useState<PackagePresetRecord | null>(null);
  const [token, setToken] = React.useState("");
  const [secretName, setSecretName] = React.useState("");
  const [secretValue, setSecretValue] = React.useState("");
  const [packageEnvironmentValues, setPackageEnvironmentValues] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const installedMcpServerKeys = React.useMemo(
    () => new Set(
      mcpServers
        .filter((server) => server.project_ids.includes(projectId))
        .flatMap((server) => [server.id, normalizeMcpTemplateUrl(server.url)]),
    ),
    [mcpServers, projectId],
  );
  const installedPackagePresetIds = React.useMemo(
    () => new Set(
      packagePresets
        .filter((packagePreset) => packagePresetInstalled(packagePreset, projectEnvironment, selectedVaultCredentials))
        .map((packagePreset) => packagePreset.id),
    ),
    [packagePresets, projectEnvironment, selectedVaultCredentials],
  );

  function mcpServerInstalled(server: RegisteredMcpServer): boolean {
    if (server.auth_type === "no_auth") {
      return installedMcpServerKeys.has(server.id) || installedMcpServerKeys.has(normalizeMcpTemplateUrl(server.url));
    }
    if (!selectedVaultId || selectedVaultCredentialsLoading) return false;
    return mcpServerRequiredCredentialInstalled(server, selectedVaultCredentials);
  }

  function openMcpServer(server: RegisteredMcpServer) {
    setSelectedMcpServer(server);
    setSelectedTutorial(null);
    setSelectedPackagePreset(null);
    setToken("");
    setSecretName("");
    setSecretValue("");
    setError(null);
  }

  function openPackagePreset(packagePreset: PackagePresetRecord) {
    setSelectedPackagePreset(packagePreset);
    setSelectedMcpServer(null);
    setSelectedTutorial(null);
    setPackageEnvironmentValues(environmentValuesForPackagePreset(packagePreset));
    setError(null);
  }

  function updatePackageEnvironmentValue(name: string, value: string) {
    setPackageEnvironmentValues((current) => ({ ...current, [name]: value }));
  }

  async function installMcpServer(event?: React.FormEvent) {
    event?.preventDefault();
    if (!selectedMcpServer) return;
    setSaving(true);
    setError(null);
    try {
      await onInstallMcpServer(selectedMcpServer, mcpInstallAuthPayload(selectedMcpServer, { token, secretName, secretValue }));
      onClose();
    } catch (installError) {
      setError(errorMessage(installError));
    } finally {
      setSaving(false);
    }
  }

  async function installPackage() {
    if (!selectedPackagePreset) return;
    setSaving(true);
    setError(null);
    try {
      await onInstallPackage(selectedPackagePreset, packageEnvironmentValues);
      onClose();
    } catch (installError) {
      setError(errorMessage(installError));
    } finally {
      setSaving(false);
    }
  }

  const showingDetail = selectedMcpServer || selectedPackagePreset || selectedTutorial;
  const title = selectedMcpServer ? "Add integration" : selectedPackagePreset ? "Add package" : selectedTutorial?.title ?? "Add integration";

  return (
    <Modal title={title} onClose={onClose} wide>
      {showingDetail ? (
        <div className="form-grid">
          {selectedMcpServer ? (
            <form className="form-grid integration-secret-form" onSubmit={installMcpServer}>
              <div className="integration-detail-head">
                <span className="integration-tile-logo"><McpServerIcon server={selectedMcpServer} fallbackSize={24} /></span>
                <span>
                  <strong>{selectedMcpServer.name}</strong>
                  <small>{selectedMcpServer.description || selectedMcpServer.url}</small>
                </span>
              </div>

              <div className="integration-install-options" aria-label="Integration resources">
                <strong className="integration-install-options-label">Required resource</strong>
                <div className="integration-resource-card selected" aria-label="MCP server selected">
                  <span className="integration-resource-card-copy">
                    <Server size={18} aria-hidden="true" />
                    <span>
                      <strong>MCP server</strong>
                      <small>{selectedMcpServer.url}</small>
                    </span>
                  </span>
                  <span className="integration-resource-badge required">
                    <Check size={13} aria-hidden="true" />
                    Required
                  </span>
                </div>
              </div>

              {selectedMcpServer.auth_type === "no_auth" ? (
                <FormSection title="Authentication">
                  <div className="structured-empty">No secret required</div>
                </FormSection>
              ) : (
                <FormSection title="Required secret">
                  {selectedMcpServer.auth_type === "static_bearer" ? (
                    <label>
                      <span>Bearer token</span>
                      <input type="password" value={token} onChange={(event) => setToken(event.target.value)} required />
                    </label>
                  ) : (
                    <>
                      <label>
                        <span>Secret name</span>
                        <input value={secretName} onChange={(event) => setSecretName(event.target.value)} placeholder="API_KEY" required />
                      </label>
                      <label>
                        <span>Secret value</span>
                        <input type="password" value={secretValue} onChange={(event) => setSecretValue(event.target.value)} required />
                      </label>
                    </>
                  )}
                </FormSection>
              )}

              {error ? <div className="notice error">{error}</div> : null}
              <div className="dialog-actions integration-detail-footer">
                <button className="secondary-button" type="button" onClick={() => { setSelectedMcpServer(null); setError(null); }}>
                  <ChevronRight className="back-icon" size={16} aria-hidden="true" />
                  Back
                </button>
                <button className="primary-button" type="submit" disabled={saving || mcpServerInstalled(selectedMcpServer)}>
                  {saving ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                  {mcpServerInstalled(selectedMcpServer) ? "Installed" : "Add"}
                </button>
              </div>
            </form>
          ) : null}

          {selectedPackagePreset ? (
            <>
              <div className="integration-detail-head">
                <span className="integration-tile-logo">{selectedPackagePreset.logo_data_url ? <img src={selectedPackagePreset.logo_data_url} alt="" /> : <Archive size={24} aria-hidden="true" />}</span>
                <span>
                  <strong>{selectedPackagePreset.name}</strong>
                  <small>{selectedPackagePreset.description || "Package preset"}</small>
                </span>
              </div>
              <div className="integration-detail-grid">
                <InfoRow icon={<Archive size={15} />} label="Package" value={selectedPackagePreset.package_name} />
                <InfoRow icon={<MonitorCog size={15} />} label="Target" value={selectedPackagePreset.target} />
              </div>
              {selectedPackagePreset.environment_variables.length > 0 ? (
                <FormSection title="Environment values">
                  {selectedPackagePreset.environment_variables.map((name) => (
                    <label key={name}>
                      <span>{name}</span>
                      <input type="password" value={packageEnvironmentValues[name] ?? ""} onChange={(event) => updatePackageEnvironmentValue(name, event.target.value)} required />
                    </label>
                  ))}
                </FormSection>
              ) : null}
              {error ? <div className="notice error">{error}</div> : null}
              <div className="dialog-actions integration-detail-footer">
                <button className="secondary-button" type="button" onClick={() => { setSelectedPackagePreset(null); setError(null); }}>
                  <ChevronRight className="back-icon" size={16} aria-hidden="true" />
                  Back
                </button>
                <button className="primary-button" type="button" onClick={() => void installPackage()} disabled={saving || installedPackagePresetIds.has(selectedPackagePreset.id) || packageEnvironmentValuesMissing(selectedPackagePreset, packageEnvironmentValues, selectedVaultCredentials)}>
                  {saving ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                  {installedPackagePresetIds.has(selectedPackagePreset.id) ? "Installed" : "Add"}
                </button>
              </div>
            </>
          ) : null}

          {selectedTutorial ? (
            <>
              <div className="markdown-message integration-tutorial-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedTutorial.markdown}</ReactMarkdown></div>
              <div className="dialog-actions integration-detail-footer">
                <button className="secondary-button" type="button" onClick={() => setSelectedTutorial(null)}>
                  <ChevronRight className="back-icon" size={16} aria-hidden="true" />
                  Back
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <div className="integration-browser">
          <div className="integration-browser-head">
            <div className="snippet-tabs integration-tabs" role="tablist" aria-label="Integration categories">
              <button className={tab === "mcpServers" ? "active" : ""} type="button" role="tab" aria-selected={tab === "mcpServers"} onClick={() => setTab("mcpServers")}>MCP Servers</button>
              <button className={tab === "packages" ? "active" : ""} type="button" role="tab" aria-selected={tab === "packages"} onClick={() => setTab("packages")}>Packages</button>
              <button className={tab === "tutorials" ? "active" : ""} type="button" role="tab" aria-selected={tab === "tutorials"} onClick={() => setTab("tutorials")}>Tutorials</button>
            </div>
          </div>
          {tab === "mcpServers" ? (
            mcpServers.length === 0 ? <div className="structured-empty">No MCP servers available</div> : (
              <div className="integration-tile-grid">
                {mcpServers.map((server) => (
                  <button className={mcpServerInstalled(server) ? "integration-tile installed" : "integration-tile"} type="button" onClick={() => openMcpServer(server)} key={server.id}>
                    <span className="integration-tile-logo"><McpServerIcon server={server} fallbackSize={24} /></span>
                    <span className="integration-tile-copy"><strong>{server.name}</strong><small>{server.description || `${mcpAuthLabel(server.auth_type)} - ${server.url}`}</small></span>
                    {mcpServerInstalled(server) ? <span className="integration-installed-badge" aria-label="Installed"><Check size={14} /></span> : null}
                  </button>
                ))}
              </div>
            )
          ) : tab === "packages" ? (
            packagePresets.length === 0 ? <div className="structured-empty">No package presets available</div> : (
              <div className="integration-tile-grid">
                {packagePresets.map((packagePreset) => (
                  <button className={installedPackagePresetIds.has(packagePreset.id) ? "integration-tile installed" : "integration-tile"} type="button" onClick={() => openPackagePreset(packagePreset)} key={packagePreset.id}>
                    <span className="integration-tile-logo">{packagePreset.logo_data_url ? <img src={packagePreset.logo_data_url} alt="" /> : <Archive size={24} aria-hidden="true" />}</span>
                    <span className="integration-tile-copy"><strong>{packagePreset.name}</strong><small>{packagePreset.description || packageEnvSummary(packagePreset) || `${packagePreset.target}: ${packagePreset.package_name}`}</small></span>
                    {installedPackagePresetIds.has(packagePreset.id) ? <span className="integration-installed-badge" aria-label="Installed"><Check size={14} /></span> : null}
                  </button>
                ))}
              </div>
            )
          ) : tutorials.length === 0 ? (
            <div className="structured-empty">No tutorials available</div>
          ) : (
            <div className="integration-tile-grid">
              {tutorials.map((tutorial) => (
                <button className="integration-tile" type="button" onClick={() => setSelectedTutorial(tutorial)} key={tutorial.id}>
                  <span className="integration-tile-logo">{tutorial.logo_data_url ? <img src={tutorial.logo_data_url} alt="" /> : <FileText size={24} />}</span>
                  <span className="integration-tile-copy"><strong>{tutorial.title}</strong><small>{tutorial.description || "Markdown tutorial"}</small></span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function ScheduleMiniEditor({
  schedule,
  prompt,
  onChange,
  onPromptChange,
  disabled = false,
}: {
  schedule: ScheduleDraft;
  prompt: string;
  onChange: (schedule: ScheduleDraft) => void;
  onPromptChange: (prompt: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="schedule-mini">
      <input value={prompt} onChange={(event) => onPromptChange(event.target.value)} disabled={disabled} placeholder="Scheduled prompt" onPointerDown={(event) => event.stopPropagation()} />
      <select value={schedule.mode} onChange={(event) => onChange({ ...schedule, mode: event.target.value as ScheduleMode })} disabled={disabled}>
        <option value="hours">Every X hours</option>
        <option value="days">Every X days</option>
        <option value="weeks">Every X weeks</option>
        <option value="cron">Cron</option>
      </select>
      {schedule.mode === "cron" ? (
        <input value={schedule.expression} onChange={(event) => onChange({ ...schedule, expression: event.target.value })} disabled={disabled} placeholder="0 9 * * 1" />
      ) : (
        <input
          type="number"
          min={1}
          value={schedule.interval}
          onChange={(event) => onChange({ ...schedule, interval: Number(event.target.value) || 1 })}
          disabled={disabled}
        />
      )}
    </div>
  );
}

function SlackTriggerMiniEditor({
  slackTrigger,
  onChange,
  disabled = false,
}: {
  slackTrigger: SlackTriggerDraft;
  onChange: (slackTrigger: SlackTriggerDraft) => void;
  disabled?: boolean;
}) {
  const value =
    slackTrigger.type === "channel"
      ? slackTrigger.channel_id ?? ""
      : slackTrigger.type === "user"
        ? slackTrigger.user_id ?? ""
        : slackTrigger.type === "keyword"
          ? slackTrigger.keyword ?? ""
          : "";
  const valuePlaceholder =
    slackTrigger.type === "channel" ? "Channel ID" : slackTrigger.type === "user" ? "User ID" : slackTrigger.type === "keyword" ? "Keyword" : "";

  return (
    <div className="slack-mini">
      <select
        value={slackTrigger.type}
        onChange={(event) => onChange(createSlackTriggerDraft(event.target.value as SlackTriggerType, slackTrigger))}
        disabled={disabled}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <option value="none">None</option>
        <option value="all">All</option>
        <option value="channel">Channel</option>
        <option value="user">User</option>
        <option value="keyword">Keyword</option>
      </select>
      {slackTrigger.type === "channel" || slackTrigger.type === "user" || slackTrigger.type === "keyword" ? (
        <input
          value={value}
          onChange={(event) => onChange(createSlackTriggerDraft(slackTrigger.type, slackTrigger, event.target.value.trim()))}
          disabled={disabled}
          placeholder={valuePlaceholder}
          onPointerDown={(event) => event.stopPropagation()}
        />
      ) : null}
    </div>
  );
}

function ApiTriggerMiniEditor({
  apiTrigger,
  apiKeys,
  onChange,
  onRotate,
  onCreate,
  onOpenInfo,
  disabled = false,
}: {
  apiTrigger: ApiTriggerDraft;
  apiKeys: ApiKeyRecord[];
  onChange: (apiTrigger: ApiTriggerDraft) => void;
  onRotate: () => void;
  onCreate: () => void;
  onOpenInfo: () => void;
  disabled?: boolean;
}) {
  void apiTrigger;
  void apiKeys;
  void onChange;
  void onRotate;
  void onCreate;

  return (
    <div className="api-mini">
      <span className="api-trigger-local-label">Anthropic cURL helper</span>
      <div className="api-mini-actions">
        <button className="secondary-button compact-button" type="button" onClick={onOpenInfo} disabled={disabled}>
          <Copy size={14} aria-hidden="true" />
          cURL
        </button>
      </div>
    </div>
  );
}

function EmailTriggerMiniEditor({
  emailTrigger,
  emailReceivers,
  onChange,
  onCreate,
  disabled = false,
}: {
  emailTrigger: EmailTriggerDraft;
  emailReceivers: EmailReceiverRecord[];
  onChange: (emailTrigger: EmailTriggerDraft) => void;
  onCreate: () => void;
  disabled?: boolean;
}) {
  const selected = emailReceivers.find((receiver) => receiver.id === emailTrigger.receiver_id);

  return (
    <div className="email-mini">
      <select
        value={emailTrigger.receiver_id}
        onChange={(event) => onChange({ receiver_id: event.target.value })}
        disabled={disabled}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <option value="">Select receiver</option>
        {emailReceivers.map((receiver) => (
          <option value={receiver.id} key={receiver.id}>
            {receiver.name}@{receiver.domain}
          </option>
        ))}
      </select>
      <div className="email-mini-row">
        <span>{selected ? `${selected.name}@${selected.domain}` : "No receiver selected"}</span>
        <button className="secondary-button compact-button" type="button" onClick={onCreate} disabled={disabled}>
          <Plus size={14} aria-hidden="true" />
          New
        </button>
      </div>
    </div>
  );
}

function ApiTriggerInfoDialog({ agentId, environmentId, vaultIds, onClose }: { agentId: string; environmentId: string; vaultIds: string[]; onClose: () => void }) {
  const [tab, setTab] = React.useState<"curl" | "node">("curl");
  const sessionEndpoint = `${ANTHROPIC_PUBLIC_API_BASE_URL}/v1/sessions`;
  const eventEndpoint = `${ANTHROPIC_PUBLIC_API_BASE_URL}/v1/sessions/$SESSION_ID/events`;
  const agentValue = agentId || "$AGENT_ID";
  const environmentValue = environmentId || "$ENVIRONMENT_ID";
  const vaultValues = vaultIds.length > 0 ? vaultIds : ["$VAULT_ID"];
  const curlSnippet = `curl -X POST "${sessionEndpoint}" \\
  -H "x-api-key: $ANTHROPIC_API_KEY" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "anthropic-beta: managed-agents-2026-04-01" \\
  -H "content-type: application/json" \\
  -d '{
    "agent": "${agentValue}",
    "environment_id": "${environmentValue}",
    "vault_ids": ${JSON.stringify(vaultValues)},
    "initial_events": [
      {
        "type": "user.message",
        "content": [
          { "type": "text", "text": "Run this trigger" }
        ]
      }
    ]
  }'`;
  const nodeSnippet = `const response = await fetch("${eventEndpoint}", {
  method: "POST",
  headers: {
    "x-api-key": process.env.ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
    "anthropic-beta": "managed-agents-2026-04-01",
    "content-type": "application/json",
  },
  body: JSON.stringify({
    events: [
      {
        type: "user.message",
        content: [{ type: "text", text: "Run this trigger" }],
      },
    ],
  }),
});

if (!response.ok) {
  throw new Error(await response.text());
}

const result = await response.json();
console.log(result);`;

  return (
    <Modal title="Anthropic cURL helper" onClose={onClose}>
      <div className="api-trigger-help">
        <p>Use your Anthropic API key from an environment variable. This local canvas does not create backend API keys.</p>
        <p>The cURL snippet starts a new session; the Node snippet sends a message to an existing session ID.</p>
        <div className="snippet-tabs" role="tablist" aria-label="API trigger examples">
          <button className={tab === "curl" ? "active" : ""} type="button" role="tab" aria-selected={tab === "curl"} onClick={() => setTab("curl")}>
            cURL
          </button>
          <button className={tab === "node" ? "active" : ""} type="button" role="tab" aria-selected={tab === "node"} onClick={() => setTab("node")}>
            Node
          </button>
        </div>
        <pre className="snippet-block">
          <code>{tab === "curl" ? curlSnippet : nodeSnippet}</code>
        </pre>
      </div>
    </Modal>
  );
}

function CanvasHelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Canvas controls" onClose={onClose}>
      <div className="canvas-help">
        <div className="shortcut-list" aria-label="Canvas shortcuts">
          <div className="shortcut-row">
            <kbd>⌘</kbd>
            <span>+</span>
            <kbd>Click</kbd>
            <p>Open card options at the clicked canvas position.</p>
          </div>
          <div className="shortcut-row">
            <kbd>Shift</kbd>
            <span>+</span>
            <kbd>A</kbd>
            <p>Open the agent creation window.</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function AgentList({
  agents,
  members,
  currentUserEmail,
  loading,
  onSelect,
  onCreate,
}: {
  agents: AgentRecord[];
  members: Member[];
  currentUserEmail: string;
  loading: boolean;
  onSelect: (record: AgentRecord) => void;
  onCreate: () => void;
}) {
  if (loading && agents.length === 0) {
    return (
      <div className="empty-state">
        <Loader2 className="spin" size={24} aria-hidden="true" />
        <span>Loading agents</span>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="empty-state">
        <Bot size={28} aria-hidden="true" />
        <strong>No agents found</strong>
        <span>Create the first managed agent for this registry.</span>
        <button className="primary-button" type="button" onClick={onCreate}>
          <Plus size={16} aria-hidden="true" />
          Create agent
        </button>
      </div>
    );
  }

  return (
    <div className="agent-table" role="table" aria-label="Agents">
      <div className="agent-table-head" role="row">
        <span>Name</span>
        <span>Scope</span>
        <span>Model</span>
        <span>Version</span>
        <span>Updated</span>
        <span>Owner</span>
      </div>
      {agents.map((record) => {
        const owned = isAgentCreatorByEmail(record, members, currentUserEmail);
        const projectCount = agentProjectIdsFromMetadata(record.agent.metadata).length;
        const global = projectCount === 0;
        return (
          <button className="agent-row" key={record.id} type="button" onClick={() => onSelect(record)} role="row">
            <span className="agent-name-cell">
              <strong>{record.agent.name}</strong>
              <small>{record.agent.description || record.id}</small>
            </span>
            <span className={global ? "owner-chip mine" : "owner-chip"}>{global ? "Global" : projectCount === 1 ? "Project" : `${projectCount} projects`}</span>
            <span>{modelLabel(record.agent.model)}</span>
            <span className="numeric-cell">v{record.agent.version}</span>
            <span className="numeric-cell">{formatDate(record.agent.updated_at)}</span>
            <span className={owned ? "owner-chip mine" : "owner-chip"}>
              {owned ? <Check size={14} aria-hidden="true" /> : <User size={14} aria-hidden="true" />}
              {owned ? "You" : shortId(record.creator_uuid)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface ParsedSessionStatusUpdate {
  id: string;
  title: string;
  agent: string;
  message: string;
  status: "failed" | "completed" | "waiting-for-answer" | "running";
  link?: string;
}

type ConnectionStatus = ParsedSessionStatusUpdate["status"] | "idle";

function ConnectionStatusIcon({ status }: { status: ConnectionStatus }) {
  const Icon = status === "completed"
    ? Check
    : status === "failed"
      ? X
      : status === "waiting-for-answer"
        ? Clock3
        : status === "running"
          ? Loader2
          : Pause;
  return <Icon className={status === "running" ? "spin" : undefined} x="-7" y="-7" width="14" height="14" strokeWidth={2.75} aria-hidden="true" />;
}

function parseSessionMessageStatusUpdates(messages: ChatMessage[]): ParsedSessionStatusUpdate[] {
  return messages.flatMap((sessionMessage) => {
    if (sessionMessage.role !== "assistant") return [];
    const updateStart = sessionMessage.content.lastIndexOf("### UPDATE");
    if (updateStart < 0) return [];

    const update = sessionMessage.content
      .slice(updateStart)
      .trim()
      .replace(/\\n/g, "\n")
      .replace(/\r\n/g, "\n");
    const match = /^### UPDATE\s*\nTITLE=([^\n]*)\nMESSAGE=([\s\S]*?)\nAGENT=([^\n]+)\nSTATUS=(failed|completed|waiting-for-answer|running)(?:\nLINK=([^\n]*))?\s*$/.exec(update);
    if (!match) return [];

    const rawLink = match[5]?.trim();
    return [{
      id: sessionMessage.id,
      title: match[1].trim(),
      message: match[2].trim(),
      agent: match[3].trim(),
      status: match[4] as ParsedSessionStatusUpdate["status"],
      ...(rawLink && isPublicHttpUrl(rawLink) ? { link: rawLink } : {}),
    }];
  });
}

function isPublicHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function PlaySessionsPanel({
  sessions,
  sessionsLoading,
  selectedSessionId,
  messages,
  loading,
  error,
  stoppingSessionId,
  onSelect,
  onRefresh,
  onSend,
  onStop,
  onClose,
}: {
  sessions: ManagedSession[];
  sessionsLoading: boolean;
  selectedSessionId: string;
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  stoppingSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onRefresh: () => Promise<void>;
  onSend: (message: string) => Promise<void>;
  onStop: (session: ManagedSession) => Promise<void>;
  onClose: () => void;
}) {
  const [tab, setTab] = React.useState<"statusUpdates" | "chat">("chat");
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const sortedSessions = React.useMemo(() => latestSessionsFirst(sessions), [sessions]);
  const latestSession = sortedSessions[0] ?? null;
  const selectedSession = sortedSessions.find((session) => session.id === selectedSessionId) ?? null;
  const selectedSessionValue = selectedSession?.id ?? latestSession?.id ?? "";
  const canStopSelectedSession = isStoppableSession(selectedSession);
  const stoppingSelectedSession = selectedSession ? stoppingSessionId === selectedSession.id : false;
  const statusUpdates = React.useMemo(() => parseSessionMessageStatusUpdates(messages), [messages]);

  React.useEffect(() => {
    if (sessionsLoading || sortedSessions.length === 0) return;
    if (selectedSessionId && sortedSessions.some((session) => session.id === selectedSessionId)) return;
    onSelect(sortedSessions[0].id);
  }, [onSelect, selectedSessionId, sessionsLoading, sortedSessions]);

  React.useEffect(() => {
    if (!selectedSession) setDetailsOpen(false);
  }, [selectedSession]);

  async function submitMessage(event: React.FormEvent) {
    event.preventDefault();
    const content = message.trim();
    if (!content || !selectedSessionId || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await onSend(content);
      setMessage("");
      setTab("chat");
    } catch (sendMessageError) {
      setSendError(errorMessage(sendMessageError));
    } finally {
      setSending(false);
    }
  }

  async function stopSession() {
    if (!selectedSession || stoppingSelectedSession) return;
    setSendError(null);
    try {
      await onStop(selectedSession);
      setTab("chat");
    } catch (stopError) {
      setSendError(errorMessage(stopError));
    }
  }

  return (
    <Modal title="Trigger sessions" onClose={onClose} side>
      <div className="play-sessions-panel">
        <div className="trigger-session-select-row">
          <label>
            <span>Session</span>
            <select value={selectedSessionValue} onChange={(event) => onSelect(event.target.value)} disabled={sortedSessions.length === 0}>
              {sortedSessions.map((session) => (
                <option value={session.id} key={session.id}>
                  {session.agent.name} · {formatDateTime(session.updated_at)}
                </option>
              ))}
            </select>
          </label>
          <button className="icon-button" type="button" onClick={() => void onRefresh()} disabled={sessionsLoading} title="Refresh sessions" aria-label="Refresh sessions">
            {sessionsLoading ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <RefreshCw size={18} aria-hidden="true" />}
          </button>
          <button className="icon-button" type="button" onClick={() => setDetailsOpen(true)} disabled={!selectedSession} title="Session details" aria-label="Open session details">
            <Info size={18} aria-hidden="true" />
          </button>
        </div>
        {!sessionsLoading && sessions.length === 0 ? (
          <div className="empty-state compact-empty">
            <MessageSquare size={22} aria-hidden="true" />
            <span>No sessions for connected agents</span>
          </div>
        ) : null}
        <div className="snippet-tabs" role="tablist" aria-label="Trigger session view">
          <button className={tab === "statusUpdates" ? "active" : ""} type="button" role="tab" aria-selected={tab === "statusUpdates"} onClick={() => setTab("statusUpdates")}>
            Status Updates
          </button>
          <button className={tab === "chat" ? "active" : ""} type="button" role="tab" aria-selected={tab === "chat"} onClick={() => setTab("chat")}>
            Chat
          </button>
        </div>
        {tab === "chat" ? (
          <ChatMessageList messages={messages} loading={loading} emptyText={sortedSessions.length === 0 ? "No sessions for connected agents." : "No messages for this session yet."} />
        ) : (
          <div className="status-update-history" aria-live="polite">
            {loading ? (
              <div className="empty-state compact-empty">
                <Loader2 className="spin" size={20} aria-hidden="true" />
                <span>Loading session messages</span>
              </div>
            ) : statusUpdates.length > 0 ? (
              statusUpdates.map((statusUpdate) => (
                <article className="status-update-card" key={statusUpdate.id}>
                  <strong>{statusUpdate.title || statusUpdate.status}</strong>
                  <span>{statusUpdate.agent} · {statusUpdate.status}</span>
                  <p>{statusUpdate.message}</p>
                  {statusUpdate.link ? (
                    <a href={statusUpdate.link} target="_blank" rel="noreferrer">
                      <ExternalLink size={14} aria-hidden="true" />
                      Open link
                    </a>
                  ) : null}
                </article>
              ))
            ) : (
              <div className="chat-placeholder">
                <Info size={24} aria-hidden="true" />
                <span>{sortedSessions.length === 0 ? "No sessions for connected agents." : "No status updates for this session yet."}</span>
              </div>
            )}
          </div>
        )}
        {tab === "chat" && error ? <div className="notice error">{error}</div> : null}
        {tab === "statusUpdates" && error ? <div className="notice error">{error}</div> : null}
        {sendError ? <div className="notice error">{sendError}</div> : null}
        <form className="chat-compose trigger-session-compose" onSubmit={submitMessage}>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={selectedSessionValue ? "Message this session" : "No session available"}
            rows={2}
            disabled={!selectedSessionValue || sending}
          />
          <div className="chat-compose-actions">
            {canStopSelectedSession ? (
              <button className="secondary-button stop-session-button" type="button" onClick={stopSession} disabled={stoppingSelectedSession} title="Stop session">
                {stoppingSelectedSession ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Square size={16} aria-hidden="true" />}
                Stop
              </button>
            ) : null}
            <button className="primary-button" type="submit" disabled={!selectedSessionValue || !message.trim() || sending}>
              {sending ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
              Send
            </button>
          </div>
        </form>
        {detailsOpen && selectedSession ? <SessionDetailsPopup session={selectedSession} onClose={() => setDetailsOpen(false)} /> : null}
      </div>
    </Modal>
  );
}

function SessionDetailsPopup({ session, onClose }: { session: ManagedSession; onClose: () => void }) {
  const modelId = sessionModelId(session);
  const usage = sessionUsageTotals(session.usage);
  const estimate = estimateManagedSessionCost(session);
  const vaultCount = session.vault_ids.length;

  return (
    <Modal title="Session details" onClose={onClose} className="session-details-modal">
      <div className="session-details-popup">
        <div className="session-detail-title">
          <span className={`session-status-pill ${session.status}`}>{formatSessionStatus(session.status)}</span>
          <strong>{session.title || session.agent.name}</strong>
          <small>{session.id}</small>
        </div>

        <div className="session-detail-grid">
          <InfoRow icon={<Bot size={15} aria-hidden="true" />} label="Agent" value={`${session.agent.name} · v${session.agent.version}`} />
          <InfoRow icon={<Server size={15} aria-hidden="true" />} label="Model" value={modelId ?? "Unavailable"} />
          <InfoRow icon={<MonitorCog size={15} aria-hidden="true" />} label="Environment" value={session.environment_id} />
          <InfoRow icon={<KeyRound size={15} aria-hidden="true" />} label="Vaults" value={vaultCount === 0 ? "None" : String(vaultCount)} />
          <InfoRow icon={<Calendar size={15} aria-hidden="true" />} label="Created" value={formatDateTime(session.created_at)} />
          <InfoRow icon={<Calendar size={15} aria-hidden="true" />} label="Updated" value={formatDateTime(session.updated_at)} />
          <InfoRow icon={<Clock3 size={15} aria-hidden="true" />} label="Running time" value={formatSessionDuration(session.stats?.active_seconds)} />
          <InfoRow icon={<Clock3 size={15} aria-hidden="true" />} label="Elapsed time" value={formatSessionDuration(session.stats?.duration_seconds)} />
        </div>

        {session.deployment_id ? (
          <div className="session-detail-row">
            <span>Deployment</span>
            <strong>{session.deployment_id}</strong>
          </div>
        ) : null}

        <section className="session-detail-section">
          <h2>Token Usage</h2>
          <div className="session-metric-grid">
            <SessionMetric label="Total tokens" value={formatTokenCount(usage?.total ?? null)} />
            <SessionMetric label="Input" value={formatTokenCount(usage?.input ?? null)} />
            <SessionMetric label="Output" value={formatTokenCount(usage?.output ?? null)} />
            <SessionMetric label="Cache read" value={formatTokenCount(usage?.cacheRead ?? null)} />
            <SessionMetric label="5m cache write" value={formatTokenCount(usage?.cacheWrite5m ?? null)} />
            <SessionMetric label="1h cache write" value={formatTokenCount(usage?.cacheWrite1h ?? null)} />
          </div>
        </section>

        <section className="session-detail-section">
          <h2>Estimated Spend</h2>
          <div className="session-metric-grid">
            <SessionMetric label="Total" value={formatUsd(estimate.totalCostUsd)} emphasis />
            <SessionMetric label="Tokens" value={formatUsd(estimate.tokenCostUsd)} />
            <SessionMetric label="Runtime" value={formatUsd(estimate.runtimeCostUsd)} />
          </div>
          {!estimate.pricingAvailable ? <p className="session-detail-note">Token estimate unavailable for this model.</p> : null}
          {estimate.totalCostUsd !== null ? <p className="session-detail-note">List-price estimate; billing may differ.</p> : null}
        </section>

        {session.metadata && Object.keys(session.metadata).length > 0 ? (
          <section className="session-detail-section">
            <h2>Metadata</h2>
            <div className="session-metadata-list">
              {Object.entries(session.metadata).map(([key, value]) => (
                <div className="session-detail-row" key={key}>
                  <span>{key}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            <X size={16} aria-hidden="true" />
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SessionMetric({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={emphasis ? "session-metric emphasis" : "session-metric"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ChatMessageList({ messages, loading, emptyText }: { messages: ChatMessage[]; loading: boolean; emptyText: string }) {
  const historyRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const history = historyRef.current;
    if (!history) return;
    history.scrollTop = history.scrollHeight;
  }, [messages, loading]);

  return (
    <div className="message-history" ref={historyRef} aria-live="polite">
      {messages.length === 0 ? (
        <div className="chat-placeholder">
          <MessageSquare size={24} aria-hidden="true" />
          <span>{emptyText}</span>
        </div>
      ) : (
        messages.map((message) => (
          <article className={message.role === "user" ? "chat-message user" : "chat-message assistant"} key={message.id}>
            <span>{message.role === "user" ? "You" : "Agent"}</span>
            {message.role === "assistant" ? <MarkdownMessage content={message.content} /> : <p>{message.content}</p>}
          </article>
        ))
      )}
      {loading ? (
        <article className="chat-message assistant">
          <span>Agent</span>
          <p className="typing-line">
            <Loader2 className="spin" size={16} aria-hidden="true" />
            Loading
          </p>
        </article>
      ) : null}
    </div>
  );
}

function ChatView({
  agents,
  environments,
  vaults,
  sessions,
  sessionsLoading,
  removingSessionId,
  stoppingSessionId,
  selectedSessionId,
  selectedAgentId,
  selectedEnvironmentId,
  selectedVaultIds,
  onAgentChange,
  onEnvironmentChange,
  onVaultToggle,
  onSessionSelect,
  onSessionRemove,
  onSessionStop,
  messages,
  input,
  onInputChange,
  loading,
  approvalLoadingId,
  error,
  onSubmit,
  onConfirmApproval,
  onCreateAgent,
}: {
  agents: AgentRecord[];
  environments: AnthropicEnvironment[];
  vaults: VaultRecord[];
  sessions: ManagedSession[];
  sessionsLoading: boolean;
  removingSessionId: string | null;
  stoppingSessionId: string | null;
  selectedSessionId: string;
  selectedAgentId: string;
  selectedEnvironmentId: string;
  selectedVaultIds: string[];
  onAgentChange: (agentId: string) => void;
  onEnvironmentChange: (environmentId: string) => void;
  onVaultToggle: (vaultId: string) => void;
  onSessionSelect: (session: ManagedSession) => void;
  onSessionRemove: (session: ManagedSession) => void;
  onSessionStop: (session: ManagedSession) => Promise<void>;
  messages: ChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  loading: boolean;
  approvalLoadingId: string | null;
  error: string | null;
  onSubmit: (event: React.FormEvent) => void;
  onConfirmApproval: (message: ChatMessage, result: "allow" | "deny") => void;
  onCreateAgent: () => void;
}) {
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const historyRef = React.useRef<HTMLDivElement | null>(null);
  const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? null;
  const canStopSelectedSession = isStoppableSession(selectedSession);
  const stoppingSelectedSession = selectedSession ? stoppingSessionId === selectedSession.id : false;

  React.useEffect(() => {
    const history = historyRef.current;
    if (!history) return;
    history.scrollTop = history.scrollHeight;
  }, [messages, loading]);

  return (
    <section className="chat-view">
      <div className="chat-panel">
        <div className="chat-controls">
          <div className="chat-agent-control">
            <label>
              <span>Agent</span>
              <select value={selectedAgentId} onChange={(event) => onAgentChange(event.target.value)} disabled={agents.length === 0}>
                {agents.map((record) => (
                  <option value={record.id} key={record.id}>
                    {record.agent.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="icon-button chat-settings-button" type="button" onClick={() => setSettingsOpen(true)} title="Chat settings">
              <Settings size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        {agents.length === 0 ? (
          <div className="empty-state chat-empty">
            <MessageSquare size={28} aria-hidden="true" />
            <strong>No agents available</strong>
            <span>Create an agent before starting a chat.</span>
            <button className="primary-button" type="button" onClick={onCreateAgent}>
              <Plus size={16} aria-hidden="true" />
              Create agent
            </button>
          </div>
        ) : environments.length === 0 ? (
          <div className="empty-state chat-empty">
            <MonitorCog size={28} aria-hidden="true" />
            <strong>No environments available</strong>
            <span>Create an environment before starting a chat.</span>
          </div>
        ) : (
          <>
            <div className="chat-history-layout">
              <aside className="session-sidebar" aria-label="Sessions">
                <div className="session-sidebar-head">
                  <span>Sessions</span>
                  {sessionsLoading ? <Loader2 className="spin" size={15} aria-hidden="true" /> : null}
                </div>
                <div className="session-list">
                  {sessions.length === 0 ? (
                    <div className="session-empty">No sessions</div>
                  ) : (
                    sessions.map((session) => (
                      <div className={session.id === selectedSessionId ? "session-item active" : "session-item"} key={session.id}>
                        <button className="session-select-button" type="button" onClick={() => onSessionSelect(session)}>
                          <strong>{session.title || session.agent.name}</strong>
                          <span>{session.agent.name}</span>
                          <small>{formatDateTime(session.updated_at)}</small>
                        </button>
                        <button
                          className="session-remove-button"
                          type="button"
                          onClick={() => onSessionRemove(session)}
                          disabled={removingSessionId === session.id}
                          title="Remove session"
                          aria-label={`Remove ${session.title || session.agent.name} session`}
                        >
                          {removingSessionId === session.id ? <Loader2 className="spin" size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </aside>

              <div className="message-history" ref={historyRef} aria-live="polite">
                {messages.length === 0 ? (
                  <div className="chat-placeholder">
                    <MessageSquare size={24} aria-hidden="true" />
                    <span>Send a message to start this session.</span>
                  </div>
                ) : (
                  messages.map((message) => (
                    <article className={message.role === "user" ? "chat-message user" : "chat-message assistant"} key={message.id}>
                      <span>{message.role === "user" ? "You" : "Agent"}</span>
                      {message.role === "assistant" ? <MarkdownMessage content={message.content} /> : <p>{message.content}</p>}
                      {message.awaitingApproval ? (
                        <div className="approval-actions">
                          {message.approvalStatus === "pending" ? (
                            <>
                              <button className="secondary-button compact-button" type="button" onClick={() => onConfirmApproval(message, "deny")} disabled={Boolean(approvalLoadingId) || loading}>
                                {approvalLoadingId === message.id ? <Loader2 className="spin" size={15} aria-hidden="true" /> : <X size={15} aria-hidden="true" />}
                                Deny
                              </button>
                              <button className="primary-button compact-button" type="button" onClick={() => onConfirmApproval(message, "allow")} disabled={Boolean(approvalLoadingId) || loading}>
                                {approvalLoadingId === message.id ? <Loader2 className="spin" size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
                                Approve
                              </button>
                            </>
                          ) : (
                            <span className={message.approvalStatus === "allowed" ? "approval-status allowed" : "approval-status denied"}>
                              {message.approvalStatus === "allowed" ? "Approved" : "Denied"}
                            </span>
                          )}
                        </div>
                      ) : null}
                    </article>
                  ))
                )}
                {loading ? (
                  <article className="chat-message assistant">
                    <span>Agent</span>
                    <p className="typing-line">
                      <Loader2 className="spin" size={16} aria-hidden="true" />
                      Thinking
                    </p>
                  </article>
                ) : null}
              </div>
            </div>

            {error ? <div className="notice error">{error}</div> : null}

            <form className="chat-compose" onSubmit={onSubmit}>
              <textarea
                value={input}
                onChange={(event) => onInputChange(event.target.value)}
                placeholder="Message the selected agent"
                rows={3}
                disabled={loading || !selectedAgentId || !selectedEnvironmentId}
              />
              <div className="chat-compose-actions">
                {canStopSelectedSession ? (
                  <button
                    className="secondary-button stop-session-button"
                    type="button"
                    onClick={() => {
                      if (selectedSession) void onSessionStop(selectedSession);
                    }}
                    disabled={stoppingSelectedSession}
                    title="Stop session"
                  >
                    {stoppingSelectedSession ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Square size={16} aria-hidden="true" />}
                    Stop
                  </button>
                ) : null}
                <button className="primary-button" type="submit" disabled={loading || !input.trim() || !selectedAgentId || !selectedEnvironmentId}>
                  {loading ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                  Send
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      {settingsOpen ? (
        <ChatSettingsDialog
          environments={environments}
          vaults={vaults}
          selectedEnvironmentId={selectedEnvironmentId}
          selectedVaultIds={selectedVaultIds}
          onEnvironmentChange={onEnvironmentChange}
          onVaultToggle={onVaultToggle}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </section>
  );
}

function ChatSettingsDialog({
  environments,
  vaults,
  selectedEnvironmentId,
  selectedVaultIds,
  onEnvironmentChange,
  onVaultToggle,
  onClose,
}: {
  environments: AnthropicEnvironment[];
  vaults: VaultRecord[];
  selectedEnvironmentId: string;
  selectedVaultIds: string[];
  onEnvironmentChange: (environmentId: string) => void;
  onVaultToggle: (vaultId: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal title="Chat settings" onClose={onClose}>
      <div className="form-grid">
        <FormSection title="Runtime">
          <label>
            <span>Environment</span>
            <select value={selectedEnvironmentId} onChange={(event) => onEnvironmentChange(event.target.value)} disabled={environments.length === 0}>
              {environments.map((environment) => (
                <option value={environment.id} key={environment.id}>
                  {environment.name}
                </option>
              ))}
            </select>
          </label>
        </FormSection>

        <FormSection title="Vaults">
          <fieldset className="vault-selector modal-vault-selector">
            <legend>Attached vaults</legend>
            {vaults.length === 0 ? (
              <span className="vault-selector-empty">No vaults available</span>
            ) : (
              <div className="vault-selector-options">
                {vaults.map((vault) => (
                  <label className="vault-checkbox" key={vault.id}>
                    <input type="checkbox" checked={selectedVaultIds.includes(vault.id)} onChange={() => onVaultToggle(vault.id)} />
                    <span>{vault.display_name}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        </FormSection>

        <div className="dialog-actions">
          <button className="primary-button" type="button" onClick={onClose}>
            <Check size={16} aria-hidden="true" />
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="markdown-message">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

function DeploymentsView({
  deployments,
  agents,
  environments,
  loading,
  runningDeploymentId,
  error,
  onRefresh,
  onOpenCreate,
  onSelect,
  onRun,
}: {
  deployments: AnthropicDeployment[];
  agents: AgentRecord[];
  environments: AnthropicEnvironment[];
  loading: boolean;
  runningDeploymentId: string | null;
  error: string | null;
  onRefresh: () => void;
  onOpenCreate: () => void;
  onSelect: (deployment: AnthropicDeployment) => void;
  onRun: (deployment: AnthropicDeployment) => void;
}) {
  return (
    <section className="deployments-view">
      <header className="toolbar">
        <div>
          <h1>Deployments</h1>
          <p>{deployments.length} configured</p>
        </div>
        <div className="toolbar-actions">
          <button className="icon-button" type="button" onClick={onRefresh} disabled={loading} title="Refresh deployments">
            {loading ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <RefreshCw size={18} aria-hidden="true" />}
          </button>
          <button className="primary-button" type="button" onClick={onOpenCreate} disabled={agents.length === 0 || environments.length === 0}>
            <Plus size={17} aria-hidden="true" />
            Create
          </button>
        </div>
      </header>

      {error ? <div className="notice error">{error}</div> : null}

      {loading && deployments.length === 0 ? (
        <div className="empty-state">
          <Loader2 className="spin" size={24} aria-hidden="true" />
          <span>Loading deployments</span>
        </div>
      ) : deployments.length === 0 ? (
        <div className="empty-state">
          <Rocket size={28} aria-hidden="true" />
          <strong>No deployments found</strong>
          <span>Create a deployment once an agent and environment exist.</span>
          <button className="primary-button" type="button" onClick={onOpenCreate} disabled={agents.length === 0 || environments.length === 0}>
            <Plus size={16} aria-hidden="true" />
            Create
          </button>
        </div>
      ) : (
        <div className="deployment-table" role="table" aria-label="Deployments">
          <div className="deployment-table-head" role="row">
            <span>Name</span>
            <span>Agent</span>
            <span>Environment</span>
            <span>Status</span>
            <span>Updated</span>
            <span>Run</span>
          </div>
          {deployments.map((deployment) => (
            <div className="deployment-row" key={deployment.id} role="row">
              <button className="deployment-select-button" type="button" onClick={() => onSelect(deployment)}>
                <span className="agent-name-cell">
                  <strong>{deployment.name}</strong>
                  <small>{deployment.description || deployment.id}</small>
                </span>
                <span>{deploymentAgentName(deployment, agents)}</span>
                <span>{environmentNameFor(deployment.environment_id, environments)}</span>
                <span className={deployment.status === "active" ? "owner-chip mine" : "owner-chip"}>{deployment.status}</span>
                <span className="numeric-cell">{formatDate(deployment.updated_at)}</span>
              </button>
              <button
                className="icon-button deployment-run-button"
                type="button"
                onClick={() => onRun(deployment)}
                disabled={Boolean(runningDeploymentId)}
                title="Run deployment now"
                aria-label={`Run ${deployment.name} now`}
              >
                {runningDeploymentId === deployment.id ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function McpServersView({
  servers,
  loading,
  error,
  onRefresh,
  onOpenCreate,
  onSelect,
}: {
  servers: RegisteredMcpServer[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onOpenCreate: () => void;
  onSelect: (server: RegisteredMcpServer) => void;
}) {
  return (
    <section className="mcp-servers-view">
      <header className="toolbar">
        <div>
          <h1>MCP Servers</h1>
          <p>{servers.length} configured</p>
        </div>
        <div className="toolbar-actions">
          <button className="icon-button" type="button" onClick={onRefresh} disabled={loading} title="Refresh MCP servers">
            {loading ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <RefreshCw size={18} aria-hidden="true" />}
          </button>
          <button className="primary-button" type="button" onClick={onOpenCreate}>
            <Plus size={17} aria-hidden="true" />
            Add
          </button>
        </div>
      </header>

      {error ? <div className="notice error">{error}</div> : null}

      {loading && servers.length === 0 ? (
        <div className="empty-state">
          <Loader2 className="spin" size={24} aria-hidden="true" />
          <span>Loading MCP servers</span>
        </div>
      ) : servers.length === 0 ? (
        <div className="empty-state">
          <Server size={28} aria-hidden="true" />
          <strong>No MCP servers found</strong>
          <span>Add MCP servers before attaching them to agents.</span>
          <button className="primary-button" type="button" onClick={onOpenCreate}>
            <Plus size={16} aria-hidden="true" />
            Add
          </button>
        </div>
      ) : (
        <div className="mcp-server-table" role="table" aria-label="MCP servers">
          <div className="mcp-server-table-head" role="row">
            <span>Icon</span>
            <span>Name</span>
            <span>URL</span>
            <span>Scope</span>
            <span>Auth</span>
            <span>Updated</span>
          </div>
          {servers.map((server) => (
            <button className="mcp-server-row" key={server.id} type="button" role="row" onClick={() => onSelect(server)}>
              <span className="mcp-server-icon-cell">{server.icon_data_url ? <img src={server.icon_data_url} alt="" /> : <Server size={20} aria-hidden="true" />}</span>
              <span className="agent-name-cell">
                <strong>{server.name}</strong>
                <small>{server.description || server.id}</small>
              </span>
              <span>{server.url}</span>
              <span className="owner-chip">{mcpScopeLabel(server)}</span>
              <span className="owner-chip">{mcpAuthLabel(server.auth_type)}</span>
              <span className="numeric-cell">{formatDate(server.updated_at)}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function SkillsView({
  skills,
  loading,
  saving,
  error,
  onRefresh,
  onOpenCreate,
  onSelect,
}: {
  skills: SkillRecord[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  onRefresh: () => void;
  onOpenCreate: () => void;
  onSelect: (skill: SkillRecord) => void;
}) {
  const builtInCount = skills.filter((skill) => skill.source === "anthropic").length;
  const customCount = skills.length - builtInCount;
  return (
    <section className="skills-view">
      <header className="toolbar">
        <div>
          <h1>Skills</h1>
          <p>{builtInCount} built-in, {customCount} custom</p>
        </div>
        <div className="toolbar-actions">
          <button className="icon-button" type="button" onClick={onRefresh} disabled={loading} title="Refresh skills">
            {loading ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <RefreshCw size={18} aria-hidden="true" />}
          </button>
          <button className="primary-button" type="button" onClick={onOpenCreate} disabled={saving}>
            {saving ? <Loader2 className="spin" size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}
            Create
          </button>
        </div>
      </header>

      {error ? <div className="notice error">{error}</div> : null}

      {loading && skills.length === 0 ? (
        <div className="empty-state">
          <Loader2 className="spin" size={24} aria-hidden="true" />
          <span>Loading skills</span>
        </div>
      ) : skills.length === 0 ? (
        <div className="empty-state">
          <Sparkles size={28} aria-hidden="true" />
          <strong>No skills found</strong>
          <span>Create a skill before attaching it to agents.</span>
          <button className="primary-button" type="button" onClick={onOpenCreate} disabled={saving}>
            <Plus size={16} aria-hidden="true" />
            Create
          </button>
        </div>
      ) : (
        <div className="skill-table" role="table" aria-label="Skills">
          <div className="skill-table-head" role="row">
            <span>Name</span>
            <span>Source</span>
            <span>Type</span>
            <span>Version</span>
            <span>Updated</span>
          </div>
          {skills.map((skill) => (
            <button className="skill-row" key={skill.id} type="button" role="row" onClick={() => onSelect(skill)}>
              <span className="agent-name-cell">
                <strong>{skill.display_title || skill.id}</strong>
                <small>{skill.description || skill.id}</small>
              </span>
              <span className="owner-chip">{skill.source}</span>
              <span>{skill.type}</span>
              <span className="numeric-cell">{skill.source === "anthropic" && !skill.latest_version ? "Built-in" : (skill.latest_version ?? "No version")}</span>
              <span className="numeric-cell">{skill.source === "anthropic" ? "Built-in" : formatDate(skill.updated_at)}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function EnvironmentsView({
  environments,
  loading,
  error,
  onRefresh,
  onOpenCreate,
  onOpenEdit,
}: {
  environments: AnthropicEnvironment[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onOpenCreate: () => void;
  onOpenEdit: (environment: AnthropicEnvironment) => void;
}) {
  return (
    <section className="environments-view">
      <header className="toolbar">
        <div>
          <h1>Environments</h1>
          <p>{environments.length} available</p>
        </div>
        <div className="toolbar-actions">
          <button className="icon-button" type="button" onClick={onRefresh} disabled={loading} title="Refresh environments">
            {loading ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <RefreshCw size={18} aria-hidden="true" />}
          </button>
          <button className="primary-button" type="button" onClick={onOpenCreate}>
            <Plus size={17} aria-hidden="true" />
            Create
          </button>
        </div>
      </header>

      {error ? <div className="notice error">{error}</div> : null}

      <div className="environment-list">
        {loading && environments.length === 0 ? (
          <div className="empty-state">
            <Loader2 className="spin" size={24} aria-hidden="true" />
            <span>Loading environments</span>
          </div>
        ) : environments.length === 0 ? (
          <div className="empty-state">
            <MonitorCog size={28} aria-hidden="true" />
            <strong>No environments found</strong>
            <span>Create a cloud or self-hosted environment.</span>
            <button className="primary-button" type="button" onClick={onOpenCreate}>
              <Plus size={16} aria-hidden="true" />
              Create
            </button>
          </div>
        ) : (
          <div className="environment-table" role="table" aria-label="Environments">
            <div className="environment-table-head" role="row">
              <span>Name</span>
              <span>Type</span>
              <span>Scope</span>
              <span>Updated</span>
              <span>Actions</span>
            </div>
            {environments.map((environment) => (
              <article className="environment-row" key={environment.id} role="row">
                <span className="agent-name-cell">
                  <strong>{environment.name}</strong>
                  <small>{environmentPackageSummary(environment) || environment.description || environment.id}</small>
                </span>
                <span className="owner-chip">{environment.config.type}</span>
                <span>{environment.scope ?? "account"}</span>
                <span className="numeric-cell">{formatDate(environment.updated_at)}</span>
                <span className="environment-actions">
                  <button className="icon-button" type="button" onClick={() => onOpenEdit(environment)} title="Edit environment">
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                </span>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SecretsView({
  vaults,
  loading,
  error,
  expandedVaultIds,
  credentialsByVault,
  credentialsLoadingByVault,
  onRefresh,
  onOpenCreateSecret,
  onToggleVault,
  onDeleteCredential,
}: {
  vaults: VaultRecord[];
  loading: boolean;
  error: string | null;
  expandedVaultIds: Set<string>;
  credentialsByVault: Record<string, VaultCredential[]>;
  credentialsLoadingByVault: Record<string, boolean>;
  onRefresh: () => void;
  onOpenCreateSecret: (vault: VaultRecord) => void;
  onToggleVault: (vaultId: string) => void;
  onDeleteCredential: (vaultId: string, credentialId: string) => void;
}) {
  return (
    <section className="secrets-view">
      <header className="toolbar">
        <div>
          <h1>Secrets</h1>
          <p>{vaults.length} vaults</p>
        </div>
        <div className="toolbar-actions">
          <button className="icon-button" type="button" onClick={onRefresh} disabled={loading} title="Refresh vaults">
            {loading ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <RefreshCw size={18} aria-hidden="true" />}
          </button>
        </div>
      </header>

      {error ? <div className="notice error">{error}</div> : null}

      {loading && vaults.length === 0 ? (
        <div className="empty-state">
          <Loader2 className="spin" size={24} aria-hidden="true" />
          <span>Loading vaults</span>
        </div>
      ) : vaults.length === 0 ? (
        <div className="empty-state">
          <LockKeyhole size={28} aria-hidden="true" />
          <strong>No vaults found</strong>
          <span>Vaults will appear here after they are created in Anthropic or by project secrets.</span>
        </div>
      ) : (
        <div className="vault-list" aria-label="Vaults">
          {vaults.map((vault) => {
            const expanded = expandedVaultIds.has(vault.id);
            const credentials = credentialsByVault[vault.id] ?? [];
            const credentialsLoading = Boolean(credentialsLoadingByVault[vault.id]);

            return (
              <article className={expanded ? "vault-tile expanded" : "vault-tile"} key={vault.id}>
                <button className="vault-tile-main" type="button" onClick={() => onToggleVault(vault.id)} aria-expanded={expanded}>
                  <span className="vault-expander">{expanded ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}</span>
                  <span className="agent-name-cell">
                    <strong>{vault.display_name}</strong>
                    <small>{vault.id}</small>
                  </span>
                  <span className="owner-chip">{vaultScopeLabel(vault)}</span>
                  <span className="numeric-cell">{formatDate(vault.updated_at)}</span>
                </button>

                {expanded ? (
                  <div className="credential-panel">
                    <div className="credential-panel-head">
                      <span>Credentials</span>
                      <div className="credential-panel-actions">
                        <strong>{credentialsLoading ? "Loading" : `${credentials.length}`}</strong>
                        {vault.can_add_credentials ? (
                          <button className="secondary-button compact-button" type="button" onClick={() => onOpenCreateSecret(vault)}>
                            <Plus size={15} aria-hidden="true" />
                            Add secret
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {credentialsLoading ? (
                      <div className="structured-empty">
                        <Loader2 className="spin" size={16} aria-hidden="true" />
                        Loading credentials
                      </div>
                    ) : credentials.length === 0 ? (
                      <div className="structured-empty">No credentials in this vault</div>
                    ) : (
                      <div className="credential-list">
                        {credentials.map((credential) => (
                          <div className="credential-row" key={credential.id}>
                            <span className="agent-name-cell">
                              <strong>{credential.display_name || credential.id}</strong>
                              <small>{credentialAuthLabel(credential.auth)}</small>
                            </span>
                            <span className="numeric-cell">{formatDate(credential.updated_at)}</span>
                            {vault.can_delete_credentials ? (
                              <button className="danger-button compact-button" type="button" onClick={() => onDeleteCredential(vault.id, credential.id)}>
                                <Trash2 size={15} aria-hidden="true" />
                                Delete
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ApiKeysView({
  apiKeys,
  loading,
  saving,
  error,
  onRefresh,
  onOpenCreate,
  onRotate,
  onDelete,
  canEdit,
}: {
  apiKeys: ApiKeyRecord[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  onRefresh: () => void;
  onOpenCreate: () => void;
  onRotate: (apiKey: ApiKeyRecord) => void;
  onDelete: (apiKey: ApiKeyRecord) => void;
  canEdit: boolean;
}) {
  return (
    <section className="api-keys-view">
      <header className="toolbar">
        <div>
          <h1>API Keys</h1>
          <p>{apiKeys.length} available</p>
        </div>
        <div className="toolbar-actions">
          <button className="icon-button" type="button" onClick={onRefresh} disabled={loading} title="Refresh API keys">
            {loading ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <RefreshCw size={18} aria-hidden="true" />}
          </button>
          <button className="primary-button" type="button" onClick={onOpenCreate} disabled={!canEdit}>
            <Plus size={17} aria-hidden="true" />
            Create
          </button>
        </div>
      </header>

      {error ? <div className="notice error">{error}</div> : null}

      {loading && apiKeys.length === 0 ? (
        <div className="empty-state">
          <Loader2 className="spin" size={24} aria-hidden="true" />
          <span>Loading API keys</span>
        </div>
      ) : apiKeys.length === 0 ? (
        <div className="empty-state">
          <KeyRound size={28} aria-hidden="true" />
          <strong>No API keys found</strong>
          <span>Create a key for server API authentication.</span>
          <button className="primary-button" type="button" onClick={onOpenCreate} disabled={!canEdit}>
            <Plus size={16} aria-hidden="true" />
            Create
          </button>
        </div>
      ) : (
        <div className="api-key-list" aria-label="API keys">
          {apiKeys.map((apiKey) => (
            <article className="api-key-tile" key={apiKey.id}>
              <div className="api-key-main">
                <span className="api-key-icon">
                  <KeyRound size={18} aria-hidden="true" />
                </span>
                <span className="agent-name-cell">
                  <strong>{apiKey.name}</strong>
                  <small>{apiKey.key_prefix}...</small>
                </span>
                <span className="api-key-meta">
                  <small>Created</small>
                  <strong>{formatDate(apiKey.created_at)}</strong>
                </span>
                <span className="api-key-meta">
                  <small>Last used</small>
                  <strong>{apiKey.last_used_at ? formatDate(apiKey.last_used_at) : "Never"}</strong>
                </span>
                <span className="api-key-meta">
                  <small>Owner</small>
                  <strong>{apiKey.creator_email ?? apiKey.creator_uuid ?? "Unknown"}</strong>
                </span>
              </div>
              <div className="api-key-actions">
                <button className="secondary-button compact-button" type="button" onClick={() => onRotate(apiKey)} disabled={saving || !canEdit}>
                  <RefreshCw size={15} aria-hidden="true" />
                  Rotate
                </button>
                <button className="danger-button compact-button" type="button" onClick={() => onDelete(apiKey)} disabled={saving || !canEdit}>
                  <Trash2 size={15} aria-hidden="true" />
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function CanvasReviewDialog({
  project,
  saving,
  mcpServers,
  integrations,
  title = "What should we build?",
  promptLabel = "Tell me what you want me to focus on",
  promptPlaceholder = "Add goals, constraints, or what the reviewer should focus on.",
  submitLabel = "Review",
  loadingLabel = "Reviewing...",
  onClose,
  onReview,
  onApply,
  onOpenIntegration,
}: {
  project: ProjectRecord;
  saving: boolean;
  mcpServers: RegisteredMcpServer[];
  integrations: IntegrationRecord[];
  title?: string;
  promptLabel?: string;
  promptPlaceholder?: string;
  submitLabel?: string;
  loadingLabel?: string;
  onClose: () => void;
  onReview: (project: ProjectRecord, prompt: string) => Promise<CanvasReviewResult>;
  onApply: (project: ProjectRecord, actions: CanvasReviewAction[]) => Promise<CanvasReviewApplyResult>;
  onOpenIntegration: (integration: IntegrationRecord) => void;
}) {
  const [prompt, setPrompt] = React.useState("");
  const [review, setReview] = React.useState<CanvasReviewResult | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(() => new Set());
  const [generating, setGenerating] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const actionRequirementsById = React.useMemo(() => {
    const requirements = new Map<string, CanvasReviewIntegrationRequirements>();
    for (const action of review?.actions ?? []) {
      requirements.set(action.id, canvasReviewIntegrationRequirements(action, integrations, mcpServers));
    }
    return requirements;
  }, [review?.actions, integrations, mcpServers]);

  const selectedActions = React.useMemo(
    () => review?.actions.filter((action) => selectedIds.has(action.id) && !canvasReviewActionHasMissingIntegrations(actionRequirementsById.get(action.id))) ?? [],
    [review?.actions, selectedIds, actionRequirementsById],
  );

  async function runReview() {
    setError(null);
    setGenerating(true);
    try {
      const nextReview = await onReview(project, prompt);
      setReview(nextReview);
      setSelectedIds(new Set(nextReview.actions
        .filter((action) => !canvasReviewActionHasMissingIntegrations(canvasReviewIntegrationRequirements(action, integrations, mcpServers)))
        .map((action) => action.id)));
      setExpandedIds(new Set());
    } catch (reviewError) {
      setError(errorMessage(reviewError));
    } finally {
      setGenerating(false);
    }
  }

  async function applySelected() {
    if (selectedActions.length === 0) return;
    setError(null);
    setApplying(true);
    try {
      const response = await onApply(project, selectedActions);
      if (response.skipped.length > 0) {
        setError(`Applied ${response.applied.length} action${response.applied.length === 1 ? "" : "s"}. Skipped ${response.skipped.length}: ${response.skipped.map((item) => item.title).join(", ")}`);
        setReview({ summary: response.applied.length > 0 ? "Selected actions were applied with some skips." : "No selected actions were applied.", actions: [] });
        setSelectedIds(new Set());
        return;
      }
      onClose();
    } catch (applyError) {
      setError(errorMessage(applyError));
    } finally {
      setApplying(false);
    }
  }

  function toggleSelected(actionId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(actionId)) next.delete(actionId);
      else next.add(actionId);
      return next;
    });
  }

  function toggleExpanded(actionId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(actionId)) next.delete(actionId);
      else next.add(actionId);
      return next;
    });
  }

  if (generating) {
    return (
      <Modal title={title} onClose={onClose} plainHeader>
        <div className="project-crafting">
          <div className="project-crafting-icon"><ClipboardCheck size={42} aria-hidden="true" /></div>
          <strong>{loadingLabel}</strong>
        </div>
      </Modal>
    );
  }

  if (review) {
    return (
      <Modal title="Canvas review" onClose={onClose} plainHeader className="canvas-review-modal">
        <div className="canvas-review-results">
          <div className="canvas-review-scroll">
            <div className="canvas-review-summary">
              <strong>{review.actions.length === 0 ? "No action items" : `${review.actions.length} action item${review.actions.length === 1 ? "" : "s"}`}</strong>
              {review.summary ? <p>{review.summary}</p> : null}
            </div>
            {error ? <div className="notice error">{error}</div> : null}
            <div className="canvas-review-action-list">
              {review.actions.map((action) => {
                const expanded = expandedIds.has(action.id);
                const selected = selectedIds.has(action.id);
                const requirements = actionRequirementsById.get(action.id);
                const hasMissingIntegrations = canvasReviewActionHasMissingIntegrations(requirements);
                return (
                  <article className={["canvas-review-action", selected && !hasMissingIntegrations ? "selected" : "", hasMissingIntegrations ? "warning" : ""].filter(Boolean).join(" ")} key={action.id}>
                    <div className="canvas-review-action-head">
                      <label className="canvas-review-check" title={hasMissingIntegrations ? "Install required integrations before applying" : selected ? "Deselect action" : "Select action"}>
                        <input type="checkbox" checked={selected && !hasMissingIntegrations} onChange={() => toggleSelected(action.id)} disabled={hasMissingIntegrations} />
                      </label>
                      <button className="canvas-review-action-toggle" type="button" onClick={() => toggleExpanded(action.id)} aria-expanded={expanded}>
                        {expanded ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                        <span>
                          <span className="canvas-review-action-title-row">
                            <strong>{action.title}</strong>
                            {hasMissingIntegrations ? <TriangleAlert size={16} aria-hidden="true" /> : null}
                          </span>
                          <small>{hasMissingIntegrations ? `${canvasReviewActionLabel(action.actionId)} · missing integrations` : canvasReviewActionLabel(action.actionId)}</small>
                        </span>
                      </button>
                    </div>
                    {expanded ? (
                      <div className="canvas-review-action-details">
                        {action.rationale ? <p>{action.rationale}</p> : null}
                        {action.details ? <p>{action.details}</p> : null}
                        {requirements && (requirements.installed.length > 0 || requirements.missing.length > 0) ? (
                          <CanvasReviewIntegrationTiles requirements={requirements} onOpenIntegration={onOpenIntegration} />
                        ) : null}
                        <pre>{JSON.stringify(canvasReviewActionPayload(action), null, 2)}</pre>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
          <div className="dialog-actions canvas-review-actions">
            <button className="secondary-button" type="button" onClick={() => { setReview(null); setError(null); }} disabled={applying || saving}>
              <ChevronRight className="back-icon" size={16} aria-hidden="true" />
              Back
            </button>
            <button className="primary-button" type="button" onClick={() => void applySelected()} disabled={applying || saving || selectedActions.length === 0}>
              {applying || saving ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
              Apply selected
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={title} onClose={onClose} plainHeader>
      <div className="canvas-review-start">
        <label>
          <span>{promptLabel}</span>
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={promptPlaceholder} rows={5} autoFocus />
        </label>
        {error ? <div className="notice error">{error}</div> : null}
        <div className="dialog-actions">
          <button className="primary-button" type="button" onClick={() => void runReview()}>
            <ClipboardCheck size={16} aria-hidden="true" />
            {submitLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function canvasReviewActionLabel(actionId: CanvasReviewActionId): string {
  if (actionId === "create-agent") return "Create agent";
  if (actionId === "update-agent") return "Update agent";
  if (actionId === "add-agent-to-canvas") return "Add agent to canvas";
  if (actionId === "add-mcp-to-canvas") return "Add MCP to canvas";
  if (actionId === "connect-mcp") return "Connect MCP";
  if (actionId === "connect-sub-agent") return "Connect sub agent";
  if (actionId === "add-trigger") return "Add trigger";
  if (actionId === "connect-trigger") return "Connect trigger";
  return "Update trigger";
}

function canvasReviewActionPayload(action: CanvasReviewAction): JsonObject {
  const { id: _id, actionId: _actionId, title: _title, rationale: _rationale, details: _details, ...payload } = action;
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)) as JsonObject;
}

interface CanvasReviewIntegrationRequirements {
  installed: Array<{ integration: IntegrationRecord; servers: RegisteredMcpServer[] }>;
  missing: IntegrationRecord[];
}

function CanvasReviewIntegrationTiles({
  requirements,
  onOpenIntegration,
}: {
  requirements: CanvasReviewIntegrationRequirements;
  onOpenIntegration: (integration: IntegrationRecord) => void;
}) {
  return (
    <div className="canvas-review-integration-grid">
      {requirements.installed.map(({ integration, servers }) => (
        <div className="canvas-review-integration-tile installed" key={`installed-${integration.id}`}>
          <span className="canvas-review-integration-icon">
            {integration.logo_data_url ? <img src={integration.logo_data_url} alt="" /> : <Rocket size={18} aria-hidden="true" />}
          </span>
          <span>
            <strong>{integration.name}</strong>
            <small>{servers.map((server) => server.name).join(", ") || "Installed"}</small>
          </span>
          <Check size={16} aria-label="Installed" />
        </div>
      ))}
      {requirements.missing.map((integration) => (
        <button className="canvas-review-integration-tile missing" type="button" onClick={() => onOpenIntegration(integration)} key={`missing-${integration.id}`}>
          <span className="canvas-review-integration-icon">
            {integration.logo_data_url ? <img src={integration.logo_data_url} alt="" /> : <Rocket size={18} aria-hidden="true" />}
          </span>
          <span>
            <strong>{integration.name}</strong>
            <small>{integration.description || integration.mcp_server_url}</small>
          </span>
          <TriangleAlert size={16} aria-label="Missing" />
        </button>
      ))}
    </div>
  );
}

function canvasReviewActionHasMissingIntegrations(requirements: CanvasReviewIntegrationRequirements | undefined): boolean {
  return (requirements?.missing.length ?? 0) > 0;
}

function canvasReviewIntegrationRequirements(
  action: CanvasReviewAction,
  integrations: IntegrationRecord[],
  mcpServers: RegisteredMcpServer[],
): CanvasReviewIntegrationRequirements {
  const installed = new Map<string, { integration: IntegrationRecord; servers: RegisteredMcpServer[] }>();
  const missing = new Map<string, IntegrationRecord>();

  for (const mcpServerId of action.mcp_server_ids ?? []) {
    const server = mcpServers.find((candidate) => candidate.id === mcpServerId);
    if (!server) continue;
    const integration = integrations.find((candidate) => mcpServerMatchesIntegrationTemplate(server, candidate));
    if (!integration) continue;
    const current = installed.get(integration.id) ?? { integration, servers: [] };
    if (!current.servers.some((candidate) => candidate.id === server.id)) current.servers.push(server);
    installed.set(integration.id, current);
  }

  for (const integrationId of action.required_integration_ids ?? []) {
    const integration = integrations.find((candidate) => candidate.id === integrationId);
    if (!integration) continue;
    const installedServers = mcpServers.filter((server) => mcpServerMatchesIntegrationTemplate(server, integration));
    if (installedServers.length > 0) {
      installed.set(integration.id, { integration, servers: installedServers });
      missing.delete(integration.id);
    } else if (!installed.has(integration.id)) {
      missing.set(integration.id, integration);
    }
  }

  return { installed: [...installed.values()], missing: [...missing.values()] };
}

function ProjectSettingsView({
  project,
  environments,
  vaults,
  credentialsByVault,
  credentialsLoadingByVault,
  saving,
  environmentSaving,
  vaultSaving,
  error,
  onSave,
  onUpdateEnvironment,
  onCreateEnvironment,
  onDeleteEnvironment,
  onLoadVaultCredentials,
  onCreateVault,
  onDeleteVault,
  onDeleteVaultCredential,
  onDelete,
}: {
  project: ProjectRecord;
  environments: AnthropicEnvironment[];
  vaults: VaultRecord[];
  credentialsByVault: Record<string, VaultCredential[]>;
  credentialsLoadingByVault: Record<string, boolean>;
  saving: boolean;
  environmentSaving: boolean;
  vaultSaving: boolean;
  error: string | null;
  onSave: (project: ProjectRecord) => void | Promise<void>;
  onUpdateEnvironment: (environmentId: string, payload: JsonObject) => Promise<void>;
  onCreateEnvironment: (project: ProjectRecord, payload?: JsonObject) => Promise<AnthropicEnvironment | null>;
  onDeleteEnvironment: (environmentId: string) => Promise<void>;
  onLoadVaultCredentials: (vaultId: string) => Promise<void>;
  onCreateVault: (project: ProjectRecord, payload?: { display_name?: string; vault_ids?: string[] }) => Promise<VaultRecord | null>;
  onDeleteVault: (vaultId: string) => Promise<void>;
  onDeleteVaultCredential: (vaultId: string, credentialId: string) => Promise<void>;
  onDelete: (project: ProjectRecord) => void;
}) {
  const [name, setName] = React.useState(project.name);
  const [environmentId, setEnvironmentId] = React.useState(projectEnvironmentId(project, environments));
  const [vaultIds, setVaultIds] = React.useState<string[]>(projectVaultIds(project, vaults));
  const [environmentCreateOpen, setEnvironmentCreateOpen] = React.useState(false);
  const [environmentDetails, setEnvironmentDetails] = React.useState<AnthropicEnvironment | null>(null);
  const [environmentToDelete, setEnvironmentToDelete] = React.useState<AnthropicEnvironment | null>(null);
  const [vaultCreateOpen, setVaultCreateOpen] = React.useState(false);
  const [vaultDetails, setVaultDetails] = React.useState<VaultRecord | null>(null);
  const [vaultToDelete, setVaultToDelete] = React.useState<VaultRecord | null>(null);

  React.useEffect(() => {
    setName(project.name);
    setEnvironmentId(projectEnvironmentId(project, environments));
    setVaultIds(projectVaultIds(project, vaults));
  }, [project.id, project.name, project.anthropic_environment_id, project.anthropic_vault_id, project.vault_ids, environments, vaults]);

  React.useEffect(() => {
    const currentEnvironmentValid = environments.some((environment) => environment.id === environmentId);
    if (environments.length === 0) {
      if (environmentId) setEnvironmentId("");
      return;
    }
    if (!environmentId || !currentEnvironmentValid) {
      setEnvironmentId(projectEnvironmentId(project, environments));
    }
  }, [environmentId, environments, project]);

  React.useEffect(() => {
    const availableVaultIds = new Set(vaults.map((vault) => vault.id));
    setVaultIds((current) => current.filter((vaultId) => availableVaultIds.has(vaultId)));
  }, [vaults]);

  const canEdit = canEditProject(project);
  const currentEnvironmentId = projectEnvironmentId(project, environments);
  const currentVaultIds = projectVaultIds(project, vaults);
  const dirty = name.trim() !== project.name || environmentId !== currentEnvironmentId || !stringArraysEqual(vaultIds, currentVaultIds);

  function projectWithSettings(nextVaultIds = vaultIds, nextEnvironmentId = environmentId): ProjectRecord {
    const selectedVaultIds = uniqueStrings(nextVaultIds);
    return {
      ...project,
      name: name.trim() || project.name,
      anthropic_environment_id: nextEnvironmentId || null,
      anthropic_vault_id: selectedVaultIds[0] ?? null,
      vault_ids: selectedVaultIds,
      is_public: false,
    };
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onSave({ ...projectWithSettings(), name: trimmedName });
  }

  function selectEnvironment(nextEnvironmentId: string) {
    if (!canEdit || saving) return;
    setEnvironmentId(nextEnvironmentId);
  }

  async function createEnvironmentForProject(payload: JsonObject) {
    if (!canEdit || saving || environmentSaving) return;
    try {
      const environment = await onCreateEnvironment(projectWithSettings(), payload);
      if (environment) setEnvironmentId(environment.id);
      setEnvironmentCreateOpen(false);
    } catch {
      // Errors are surfaced by the owning project/environment state.
    }
  }

  async function deleteSelectedEnvironment() {
    if (!environmentToDelete || saving || environmentSaving) return;
    const deletedEnvironmentId = environmentToDelete.id;
    const nextEnvironmentId = environmentId === deletedEnvironmentId
      ? environments.find((environment) => environment.id !== deletedEnvironmentId)?.id ?? ""
      : environmentId;
    try {
      await onDeleteEnvironment(deletedEnvironmentId);
      setEnvironmentId(nextEnvironmentId);
      if (environmentId === deletedEnvironmentId || project.anthropic_environment_id === deletedEnvironmentId) {
        await onSave(projectWithSettings(vaultIds, nextEnvironmentId));
      }
      setEnvironmentToDelete(null);
    } catch {
      // Errors are surfaced by the owning project/environment state.
    }
  }

  function openVaultDetails(vault: VaultRecord) {
    setVaultDetails(vault);
    if (!credentialsByVault[vault.id] && !credentialsLoadingByVault[vault.id]) {
      void onLoadVaultCredentials(vault.id);
    }
  }

  function toggleVault(vaultId: string) {
    if (!canEdit || saving) return;
    setVaultIds((current) => (
      current.includes(vaultId)
        ? current.filter((selectedVaultId) => selectedVaultId !== vaultId)
        : [...current, vaultId]
    ));
  }

  async function createVaultForProject(payload: { display_name: string }) {
    if (!canEdit || saving || vaultSaving) return;
    try {
      const baseProject = projectWithSettings();
      const vault = await onCreateVault(baseProject, { ...payload, vault_ids: baseProject.vault_ids ?? [] });
      if (vault) setVaultIds((current) => uniqueStrings([...current, vault.id]));
      setVaultCreateOpen(false);
    } catch {
      // Errors are surfaced by the owning project/vault state.
    }
  }

  async function deleteSelectedVault() {
    if (!vaultToDelete || saving || vaultSaving) return;
    const deletedVaultId = vaultToDelete.id;
    const nextVaultIds = vaultIds.filter((vaultId) => vaultId !== deletedVaultId);
    try {
      await onDeleteVault(deletedVaultId);
      setVaultIds(nextVaultIds);
      await onSave(projectWithSettings(nextVaultIds));
      setVaultToDelete(null);
    } catch {
      // Errors are surfaced by the owning project/vault state.
    }
  }

  return (
    <section className="project-settings-view">
      {error ? <div className="notice error">{error}</div> : null}

      <form className="form-grid project-settings-form" onSubmit={submit}>
        <FormSection title="Details">
          <label>
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} disabled={!canEdit} required />
          </label>
          <div className="project-resource-picker">
            <div className="project-resource-picker-head">
              <span>Anthropic environment</span>
              <button
                className="secondary-button compact-button"
                type="button"
                onClick={() => setEnvironmentCreateOpen(true)}
                disabled={!canEdit || saving || environmentSaving}
              >
                {environmentSaving ? <Loader2 className="spin" size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
                Add environment
              </button>
            </div>
            <div className="project-resource-tile-list" role="radiogroup" aria-label="Anthropic environments">
              {environments.length === 0 ? (
                <div className="vault-selector-empty">No environments available</div>
              ) : (
                environments.map((environment) => {
                  const selected = environmentId === environment.id;
                  return (
                    <article className={selected ? "project-resource-tile selected" : "project-resource-tile"} key={environment.id}>
                      <button
                        className="project-resource-select"
                        type="button"
                        onClick={() => selectEnvironment(environment.id)}
                        disabled={!canEdit || saving}
                        role="radio"
                        aria-checked={selected}
                      >
                        <span className="project-resource-check" aria-hidden="true">
                          {selected ? <Check size={15} /> : null}
                        </span>
                        <span className="project-resource-copy">
                          <strong>{environment.name}</strong>
                          <small>{environment.config.type} · {environmentPackageSummary(environment) || environment.description || environment.id}</small>
                        </span>
                      </button>
                      <button
                        className="icon-button project-resource-action"
                        type="button"
                        onClick={() => setEnvironmentDetails(environment)}
                        disabled={saving}
                        title={`View ${environment.name} details`}
                        aria-label={`View ${environment.name} details`}
                      >
                        <Info size={16} aria-hidden="true" />
                      </button>
                      <button
                        className="icon-button project-resource-remove"
                        type="button"
                        onClick={() => setEnvironmentToDelete(environment)}
                        disabled={!canEdit || saving || environmentSaving}
                        title={`Delete ${environment.name}`}
                        aria-label={`Delete ${environment.name}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </article>
                  );
                })
              )}
            </div>
          </div>
          <div className="project-resource-picker">
            <div className="project-resource-picker-head">
              <span>Anthropic vaults</span>
              <button
                className="secondary-button compact-button"
                type="button"
                onClick={() => setVaultCreateOpen(true)}
                disabled={!canEdit || saving || vaultSaving}
              >
                {vaultSaving ? <Loader2 className="spin" size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
                Add vault
              </button>
            </div>
            <div className="project-resource-tile-list" role="group" aria-label="Anthropic vaults">
              {vaults.length === 0 ? (
                <div className="vault-selector-empty">No vaults available</div>
              ) : (
                vaults.map((vault) => {
                  const selected = vaultIds.includes(vault.id);
                  return (
                    <article className={selected ? "project-resource-tile selected" : "project-resource-tile"} key={vault.id}>
                      <button
                        className="project-resource-select"
                        type="button"
                        onClick={() => toggleVault(vault.id)}
                        disabled={!canEdit || saving}
                        aria-pressed={selected}
                      >
                        <span className="project-resource-check" aria-hidden="true">
                          {selected ? <Check size={15} /> : null}
                        </span>
                        <span className="project-resource-copy">
                          <strong>{vault.display_name}</strong>
                          <small>{vaultScopeLabel(vault)} · {vault.id}</small>
                        </span>
                      </button>
                      <button
                        className="icon-button project-resource-action"
                        type="button"
                        onClick={() => openVaultDetails(vault)}
                        disabled={saving}
                        title={`View ${vault.display_name} details`}
                        aria-label={`View ${vault.display_name} details`}
                      >
                        <Info size={16} aria-hidden="true" />
                      </button>
                      <button
                        className="icon-button project-resource-remove"
                        type="button"
                        onClick={() => setVaultToDelete(vault)}
                        disabled={!canEdit || saving || vaultSaving || !vault.can_delete_vault}
                        title={vault.can_delete_vault ? `Delete ${vault.display_name}` : "This vault cannot be deleted"}
                        aria-label={`Delete ${vault.display_name}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </FormSection>
        <div className="dialog-actions">
          <button className="danger-button" type="button" onClick={() => onDelete(project)} disabled={saving || !canEdit}>
            <Trash2 size={16} aria-hidden="true" />
            Delete project
          </button>
          <button className="primary-button" type="submit" disabled={saving || !canEdit || !dirty || !name.trim()}>
            {saving ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
            Save
          </button>
        </div>
      </form>
      {environmentCreateOpen ? (
        <CreateProjectEnvironmentDialog
          saving={environmentSaving}
          onClose={() => setEnvironmentCreateOpen(false)}
          onCreate={createEnvironmentForProject}
        />
      ) : null}
      {environmentDetails ? (
        <EnvironmentDetailsDialog
          environment={environmentDetails}
          saving={environmentSaving}
          onClose={() => setEnvironmentDetails(null)}
          onSave={async (payload) => {
            await onUpdateEnvironment(environmentDetails.id, payload);
            setEnvironmentDetails(null);
          }}
        />
      ) : null}
      {environmentToDelete ? (
        <ConfirmDialog
          title="Delete environment"
          message={`Delete "${environmentToDelete.name}"? Project runs using this environment will need another environment selected.`}
          confirmLabel="Delete"
          danger
          onCancel={() => setEnvironmentToDelete(null)}
          onConfirm={() => void deleteSelectedEnvironment()}
        />
      ) : null}
      {vaultCreateOpen ? (
        <CreateVaultDialog
          saving={vaultSaving}
          onClose={() => setVaultCreateOpen(false)}
          onCreate={createVaultForProject}
        />
      ) : null}
      {vaultDetails ? (
        <VaultDetailsDialog
          vault={vaultDetails}
          credentials={credentialsByVault[vaultDetails.id] ?? []}
          loading={credentialsLoadingByVault[vaultDetails.id] === true}
          onRefresh={() => onLoadVaultCredentials(vaultDetails.id)}
          onClose={() => setVaultDetails(null)}
          onDeleteCredential={(credentialId) => onDeleteVaultCredential(vaultDetails.id, credentialId)}
        />
      ) : null}
      {vaultToDelete ? (
        <ConfirmDialog
          title="Delete vault"
          message={`Delete "${vaultToDelete.display_name}"? Stored credentials in this vault will no longer be available.`}
          confirmLabel="Delete"
          danger
          onCancel={() => setVaultToDelete(null)}
          onConfirm={() => void deleteSelectedVault()}
        />
      ) : null}
    </section>
  );
}

const projectIntroExamples = [
  "Build a support workflow that triages customer requests and escalates urgent issues.",
  "Create a sales research map that enriches leads, drafts outreach, and logs follow-ups.",
  "Set up a release operations canvas that checks readiness and posts status updates.",
];

function CreateProjectDialog({
  saving,
  onClose,
  onCreate,
}: {
  saving: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setError(null);
    try {
      await onCreate(trimmedName);
    } catch (createError) {
      setError(errorMessage(createError));
    }
  }

  return (
    <Modal title="New Project" onClose={onClose} plainHeader>
      <form className="project-create-form" onSubmit={submit}>
        <label>
          <span>What should we call your project?</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Project name" autoFocus required />
        </label>
        {error ? <div className="notice error">{error}</div> : null}
        <div className="dialog-actions">
          <button className="primary-button" type="submit" disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
            Start
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CreateProjectIntroDialog({
  saving,
  onClose,
  onGenerate,
  onConfirm,
  onSkip,
}: {
  saving: boolean;
  onClose: () => void;
  onGenerate: (prompt: string) => Promise<GeneratedProjectPlan>;
  onConfirm: (plan: GeneratedProjectPlan) => Promise<void>;
  onSkip: () => Promise<void>;
}) {
  const [prompt, setPrompt] = React.useState("");
  const [plan, setPlan] = React.useState<GeneratedProjectPlan | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [generating, setGenerating] = React.useState(false);

  function playExample(example: string) {
    setPrompt(example);
    setPlan(null);
    setError(null);
  }

  async function runPrompt() {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;
    setError(null);
    setPlan(null);
    setGenerating(true);
    try {
      setPlan(await onGenerate(trimmedPrompt));
    } catch (generateError) {
      setError(errorMessage(generateError));
    } finally {
      setGenerating(false);
    }
  }

  async function confirmPlan() {
    if (!plan) return;
    setError(null);
    try {
      await onConfirm(plan);
    } catch (confirmError) {
      setError(errorMessage(confirmError));
    }
  }

  if (generating) {
    return (
      <Modal title="New Project" onClose={onClose} plainHeader>
        <div className="project-crafting">
          <div className="project-crafting-icon">
            <Bot size={42} aria-hidden="true" />
          </div>
          <strong>Crafting...</strong>
        </div>
      </Modal>
    );
  }

  if (plan) {
    return (
      <Modal title="Proposed setup" onClose={onClose} plainHeader className="project-proposal-modal">
        <div className="project-intro project-proposal">
          <div className="project-proposal-scroll">
            <GeneratedProjectPlanPreview plan={plan} />
            {error ? <div className="notice error">{error}</div> : null}
          </div>
          <div className="dialog-actions project-proposal-actions">
            <button className="secondary-button" type="button" onClick={() => setPlan(null)} disabled={saving}>
              <ChevronRight className="back-icon" size={16} aria-hidden="true" />
              Back
            </button>
            <button className="primary-button" type="button" onClick={() => void confirmPlan()} disabled={saving}>
              {saving ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
              Create project
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="New Project" onClose={onClose} plainHeader>
      <div className="project-intro">
        <div className="project-intro-start">
          <div className="project-intro-label">Get started with</div>
          <div className="project-intro-examples">
            {projectIntroExamples.map((example) => (
              <div className="project-intro-example" key={example}>
                <Sparkles size={16} aria-hidden="true" />
                <span>{example}</span>
                <button className="icon-button" type="button" onClick={() => playExample(example)} title="Use prompt">
                  <Play size={16} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="project-intro-prompt">
          <input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Describe the agent map you want" />
          <button className="primary-button" type="button" onClick={() => void runPrompt()} disabled={saving || !prompt.trim()}>
            <Sparkles size={16} aria-hidden="true" />
            Generate
          </button>
        </div>

        {error ? <div className="notice error">{error}</div> : null}

        <button className="project-intro-skip" type="button" onClick={() => void onSkip()} disabled={saving}>
          {saving ? <Loader2 className="spin" size={16} aria-hidden="true" /> : null}
          Continue with a blank project.
        </button>
      </div>
    </Modal>
  );
}

function GeneratedProjectPlanPreview({ plan }: { plan: GeneratedProjectPlan }) {
  const childIdsByAgent = React.useMemo(() => {
    const result = new Map<string, string[]>();
    for (const connection of plan.connections) {
      if (connection.type !== "sub_agent") continue;
      result.set(connection.from, [...(result.get(connection.from) ?? []), connection.to]);
    }
    return result;
  }, [plan.connections]);
  const rootAgents = React.useMemo(() => {
    const childIds = new Set(Array.from(childIdsByAgent.values()).flat());
    const roots = plan.agents.filter((agent) => !childIds.has(agent.id));
    return roots.length > 0 ? roots : plan.agents;
  }, [childIdsByAgent, plan.agents]);
  const [expandedAgentIds, setExpandedAgentIds] = React.useState<Set<string>>(() => new Set());

  function toggleAgent(agentId: string) {
    setExpandedAgentIds((current) => {
      const next = new Set(current);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  }

  return (
    <div className="generated-plan-preview">
      <h3 className="generated-plan-section-title">Canvas</h3>
      <div className="generated-plan-head">
        <strong>{plan.project.name}</strong>
      </div>
      {plan.triggers?.length > 0 ? (
        <>
          <h3 className="generated-plan-section-title">Triggers</h3>
          <div className="generated-agent-details">
            {plan.triggers.map((trigger) => (
              <InfoRow icon={generatedTriggerIcon(trigger.type)} label={generatedTriggerTypeLabel(trigger.type)} value={`${trigger.name}${trigger.description ? ` - ${trigger.description}` : ""}`} key={trigger.id} />
            ))}
          </div>
        </>
      ) : null}
      <h3 className="generated-plan-section-title">Agents</h3>
      <div className="generated-agent-tree" role="tree" aria-label="Proposed agents">
        {rootAgents.map((agent) => (
          <GeneratedAgentTreeItem
            agent={agent}
            depth={0}
            expandedAgentIds={expandedAgentIds}
            childIdsByAgent={childIdsByAgent}
            plan={plan}
            onToggle={toggleAgent}
            ancestorIds={new Set()}
            key={agent.id}
          />
        ))}
      </div>
    </div>
  );
}

function generatedTriggerTypeLabel(type: GeneratedProjectPlan["triggers"][number]["type"]): string {
  if (type === "play") return "Play";
  if (type === "schedule") return "Schedule";
  if (type === "slack") return "Slack";
  if (type === "api") return "API";
  return "Email";
}

function generatedTriggerIcon(type: GeneratedProjectPlan["triggers"][number]["type"]): React.ReactNode {
  if (type === "play") return <Play size={15} />;
  if (type === "schedule") return <Calendar size={15} />;
  if (type === "slack") return <MessageSquare size={15} />;
  if (type === "api") return <KeyRound size={15} />;
  return <Mail size={15} />;
}

function GeneratedAgentTreeItem({
  agent,
  depth,
  expandedAgentIds,
  childIdsByAgent,
  plan,
  onToggle,
  ancestorIds,
}: {
  agent: GeneratedProjectPlan["agents"][number];
  depth: number;
  expandedAgentIds: Set<string>;
  childIdsByAgent: Map<string, string[]>;
  plan: GeneratedProjectPlan;
  onToggle: (agentId: string) => void;
  ancestorIds: Set<string>;
}) {
  const expanded = expandedAgentIds.has(agent.id);
  const childAgents = (childIdsByAgent.get(agent.id) ?? []).flatMap((childId) => {
    if (ancestorIds.has(childId) || childId === agent.id) return [];
    const childAgent = plan.agents.find((candidate) => candidate.id === childId);
    return childAgent ? [childAgent] : [];
  });
  const mcps = plan.connections
    .filter((connection) => connection.type === "uses_mcp" && connection.from === agent.id)
    .flatMap((connection) => {
      const mcp = plan.mcps.find((candidate) => candidate.id === connection.to);
      return mcp ? [mcp] : [];
    });
  const skillIds = new Set([...(agent.skill_ids ?? []), ...plan.connections.filter((connection) => connection.type === "uses_skill" && connection.from === agent.id).map((connection) => connection.to)]);
  const skills = plan.skills.filter((skill) => skillIds.has(skill.id));
  const nextAncestorIds = new Set([...ancestorIds, agent.id]);

  return (
    <div className="generated-agent-tree-row" style={{ "--tree-depth": depth } as React.CSSProperties} role="treeitem" aria-expanded={expanded}>
      <button className="generated-agent-tile" type="button" onClick={() => onToggle(agent.id)}>
        <ChevronRight className={expanded ? "tree-chevron expanded" : "tree-chevron"} size={16} aria-hidden="true" />
        <span>
          <strong>{agent.name}</strong>
          <small>{agent.description}</small>
        </span>
      </button>
      {expanded ? (
        <div className="generated-agent-details">
          <InfoRow icon={<Bot size={15} />} label="Name" value={agent.name} />
          <InfoRow icon={<Info size={15} />} label="Description" value={agent.description || "None"} />
          <InfoRow icon={<Server size={15} />} label="Model" value={agent.model || defaultAgentModel} />
          <div className="generated-agent-field boxed">
            <span>System prompt</span>
            <p>{agent.system_prompt}</p>
          </div>
          <div className="generated-agent-field boxed">
            <span>MCPs</span>
            {mcps.length === 0 ? <p>None</p> : <p>{mcps.map((mcp) => mcp.name).join(", ")}</p>}
          </div>
          <div className="generated-agent-field boxed">
            <span>Skills</span>
            {skills.length === 0 ? <p>None</p> : <p>{skills.map((skill) => skill.name).join(", ")}</p>}
          </div>
        </div>
      ) : null}
      {childAgents.length > 0 ? (
        <div className="generated-agent-children" role="group">
          {childAgents.map((childAgent) => (
            <GeneratedAgentTreeItem
              agent={childAgent}
              depth={depth + 1}
              expandedAgentIds={expandedAgentIds}
              childIdsByAgent={childIdsByAgent}
              plan={plan}
              onToggle={onToggle}
              ancestorIds={nextAncestorIds}
              key={childAgent.id}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ApiKeyRevealToast({ revealedApiKey, onClose }: { revealedApiKey: { name: string; key: string }; onClose: () => void }) {
  const [copied, setCopied] = React.useState(false);

  async function copyKey() {
    await navigator.clipboard.writeText(revealedApiKey.key);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="api-key-toast" role="status" aria-live="polite">
      <div>
        <strong>{revealedApiKey.name}</strong>
        <span>Store this key now. It will not be shown again.</span>
      </div>
      <input className="code-input" value={revealedApiKey.key} readOnly onFocus={(event) => event.currentTarget.select()} aria-label="New API key" />
      <div className="api-key-toast-actions">
        <button className="secondary-button compact-button" type="button" onClick={() => void copyKey()}>
          <Copy size={15} aria-hidden="true" />
          {copied ? "Copied" : "Copy"}
        </button>
        <button className="icon-button" type="button" onClick={onClose} title="Close">
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function MembersView({
  members,
  auth,
  loading,
  error,
  savingRoleUuid,
  onRefresh,
  onRoleChange,
}: {
  members: Member[];
  auth: AuthSession;
  loading: boolean;
  error: string | null;
  savingRoleUuid: string | null;
  onRefresh: () => void;
  onRoleChange: (member: Member, role: WorkspaceRole) => void;
}) {
  const localMember = members.find((member) => member.uuid === auth.uuid) ?? { uuid: auth.uuid, email: auth.email, role: auth.role ?? "member" };
  const orderedMembers = [localMember, ...members.filter((member) => member.uuid !== auth.uuid)];
  const canManageRoles = localMember.role === "admin";

  return (
    <section className="members-view">
      <header className="toolbar">
        <div>
          <h1>Members</h1>
          <p>{members.length} signed in</p>
        </div>
        <div className="toolbar-actions">
          <button className="icon-button" type="button" onClick={onRefresh} disabled={loading} title="Refresh members">
            {loading ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <RefreshCw size={18} aria-hidden="true" />}
          </button>
        </div>
      </header>

      {error ? <div className="notice error">{error}</div> : null}

      {loading && orderedMembers.length === 0 ? (
        <div className="empty-state">
          <Loader2 className="spin" size={24} aria-hidden="true" />
          <span>Loading members</span>
        </div>
      ) : (
        <div className="member-table" role="table" aria-label="Members">
          <div className="member-table-head" role="row">
            <span>Member</span>
            <span>Role</span>
          </div>
          {orderedMembers.map((member) => {
            const isLocal = member.uuid === auth.uuid;
            return (
              <article className={isLocal ? "member-row local" : "member-row"} key={member.uuid} role="row">
                <span className="agent-name-cell">
                  <strong>
                    {member.email}
                    {isLocal ? <small className="inline-you-label"> (You)</small> : null}
                  </strong>
                  <small>{member.uuid}</small>
                </span>
                <span className="member-role-cell">
                  {canManageRoles ? (
                    <select
                      value={member.role}
                      onChange={(event) => onRoleChange(member, event.target.value as WorkspaceRole)}
                      disabled={savingRoleUuid === member.uuid}
                      aria-label={`Role for ${member.email}`}
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                    </select>
                  ) : (
                    <strong>{workspaceRoleLabel(member.role)}</strong>
                  )}
                </span>
              </article>
            );
          })}
          {orderedMembers.length === 1 && members.length === 0 ? (
            <article className="member-row muted" role="row">
              <span className="agent-name-cell">
                <strong>No other members found</strong>
              </span>
              <span />
            </article>
          ) : null}
        </div>
      )}
    </section>
  );
}

function CreateVaultDialog({
  saving,
  onClose,
  onCreate,
}: {
  saving: boolean;
  onClose: () => void;
  onCreate: (payload: { display_name: string }) => Promise<void>;
}) {
  const [name, setName] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    try {
      const displayName = name.trim();
      if (!displayName) throw new Error("Vault name is required.");
      await onCreate({ display_name: displayName });
    } catch (submitError) {
      setFormError(errorMessage(submitError));
    }
  }

  return (
    <Modal title="Create vault" onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <FormSection title="Basics">
          <label>
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required autoFocus />
          </label>
        </FormSection>
        {formError ? <div className="notice error">{formError}</div> : null}
        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            <X size={16} aria-hidden="true" />
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            Create
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CreateProjectEnvironmentDialog({
  saving,
  onClose,
  onCreate,
}: {
  saving: boolean;
  onClose: () => void;
  onCreate: (payload: JsonObject) => Promise<void>;
}) {
  const [name, setName] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    try {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("Environment name is required.");
      await onCreate({
        name: trimmedName,
        config: defaultEnvironmentConfig("cloud"),
      });
    } catch (submitError) {
      setFormError(errorMessage(submitError));
    }
  }

  return (
    <Modal title="Create environment" onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <FormSection title="Basics">
          <label>
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required autoFocus />
          </label>
        </FormSection>
        {formError ? <div className="notice error">{formError}</div> : null}
        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            <X size={16} aria-hidden="true" />
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            Create
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EnvironmentDetailsDialog({
  environment,
  saving,
  onClose,
  onSave,
}: {
  environment: AnthropicEnvironment;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: JsonObject) => Promise<void>;
}) {
  const [spec, setSpec] = React.useState(formatJson(environment.config));
  const [formError, setFormError] = React.useState<string | null>(null);
  const packageRows = environmentPackageRowsFromSpec(spec);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    try {
      const config = parseJsonObject(spec, "Spec file");
      await onSave({
        name: environment.name,
        description: environment.description,
        config,
        metadata: environment.metadata,
        scope: environment.scope,
      });
    } catch (submitError) {
      setFormError(errorMessage(submitError));
    }
  }

  return (
    <Modal title="Environment details" onClose={onClose} className="resource-details-modal">
      <form className="resource-details-layout" onSubmit={submit}>
        <div className="resource-details-scroll">
          <FormSection title={environment.name}>
            <div className="details-info-grid">
              <InfoRow icon={<MonitorCog size={15} aria-hidden="true" />} label="Type" value={environment.config.type} />
              <InfoRow icon={<Shield size={15} aria-hidden="true" />} label="Scope" value={environment.scope ?? "account"} />
              <InfoRow icon={<Calendar size={15} aria-hidden="true" />} label="Updated" value={formatDateTime(environment.updated_at)} />
            </div>
          </FormSection>

          <FormSection title="Packages">
            {packageRows.length === 0 ? (
              <div className="structured-empty">No packages configured in the spec file</div>
            ) : (
              <div className="resource-package-list">
                {packageRows.map(({ manager, packages }) => (
                  <div className="resource-package-row" key={manager}>
                    <span className="owner-chip">{manager}</span>
                    <strong>{packages.join(", ")}</strong>
                  </div>
                ))}
              </div>
            )}
          </FormSection>

          <FormSection title="Spec file">
            <JsonEditor label="Environment config" value={spec} onChange={setSpec} rows={10} disabled={saving} />
          </FormSection>

          {formError ? <div className="notice error">{formError}</div> : null}
        </div>

        <div className="dialog-actions resource-details-actions">
          <button className="secondary-button" type="button" onClick={onClose} disabled={saving}>
            <X size={16} aria-hidden="true" />
            Close
          </button>
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
            Save spec
          </button>
        </div>
      </form>
    </Modal>
  );
}

function VaultDetailsDialog({
  vault,
  credentials,
  loading,
  onRefresh,
  onClose,
  onDeleteCredential,
}: {
  vault: VaultRecord;
  credentials: VaultCredential[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onClose: () => void;
  onDeleteCredential: (credentialId: string) => Promise<void>;
}) {
  const [credentialToDelete, setCredentialToDelete] = React.useState<VaultCredential | null>(null);
  const [removingCredentialId, setRemovingCredentialId] = React.useState<string | null>(null);

  async function deleteSelectedCredential() {
    if (!credentialToDelete || removingCredentialId) return;
    setRemovingCredentialId(credentialToDelete.id);
    try {
      await onDeleteCredential(credentialToDelete.id);
      setCredentialToDelete(null);
    } finally {
      setRemovingCredentialId(null);
    }
  }

  return (
    <Modal title="Vault details" onClose={onClose} className="resource-details-modal">
      <div className="resource-details-layout">
        <div className="resource-details-scroll">
          <FormSection title={vault.display_name}>
            <div className="details-info-grid">
              <InfoRow icon={<KeyRound size={15} aria-hidden="true" />} label="Scope" value={vaultScopeLabel(vault)} />
              <InfoRow icon={<Calendar size={15} aria-hidden="true" />} label="Updated" value={formatDateTime(vault.updated_at)} />
              <InfoRow icon={<Info size={15} aria-hidden="true" />} label="Vault ID" value={vault.id} />
            </div>
          </FormSection>

          <FormSection title="Secrets">
            <div className="credential-panel-head">
              <span>{loading ? "Loading secrets" : `${credentials.length} secrets`}</span>
              <button className="icon-button" type="button" onClick={() => void onRefresh()} disabled={loading} title="Refresh secrets">
                {loading ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}
              </button>
            </div>
            {loading ? (
              <div className="structured-empty">
                <Loader2 className="spin" size={16} aria-hidden="true" />
                Loading secrets
              </div>
            ) : credentials.length === 0 ? (
              <div className="structured-empty">No secrets in this vault</div>
            ) : (
              <div className="credential-list">
                {credentials.map((credential) => (
                  <div className="credential-row" key={credential.id}>
                    <span className="agent-name-cell">
                      <strong>{credential.display_name || credential.id}</strong>
                      <small>{credentialAuthLabel(credential.auth)}</small>
                    </span>
                    <span className="numeric-cell">{formatDate(credential.updated_at)}</span>
                    {vault.can_delete_credentials ? (
                      <button className="danger-button compact-button" type="button" onClick={() => setCredentialToDelete(credential)} disabled={removingCredentialId === credential.id}>
                        {removingCredentialId === credential.id ? <Loader2 className="spin" size={15} aria-hidden="true" /> : <Trash2 size={15} aria-hidden="true" />}
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </FormSection>
        </div>

        <div className="dialog-actions resource-details-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            <X size={16} aria-hidden="true" />
            Close
          </button>
        </div>
      </div>

      {credentialToDelete ? (
        <ConfirmDialog
          title="Remove secret"
          message={`Remove "${credentialToDelete.display_name || credentialToDelete.id}" from ${vault.display_name}?`}
          confirmLabel="Remove"
          danger
          onCancel={() => setCredentialToDelete(null)}
          onConfirm={() => void deleteSelectedCredential()}
        />
      ) : null}
    </Modal>
  );
}

function CreateApiKeyDialog({
  saving,
  onClose,
  onCreate,
  side,
}: {
  saving: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
  side?: boolean;
}) {
  const [name, setName] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    try {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("API key name is required.");
      await onCreate(trimmedName);
    } catch (submitError) {
      setFormError(errorMessage(submitError));
    }
  }

  return (
    <Modal title="Create API key" onClose={onClose} side={side}>
      <form className="form-grid" onSubmit={submit}>
        <FormSection title="Basics">
          <label>
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required autoFocus />
          </label>
        </FormSection>
        {formError ? <div className="notice error">{formError}</div> : null}
        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            <X size={16} aria-hidden="true" />
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            Create
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CreateEmailReceiverDialog({
  saving,
  onClose,
  onCreate,
  side,
}: {
  saving: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
  side?: boolean;
}) {
  const [name, setName] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    try {
      const trimmedName = name.trim().toLowerCase();
      if (!trimmedName) throw new Error("Receiver name is required.");
      await onCreate(trimmedName);
    } catch (submitError) {
      setFormError(errorMessage(submitError));
    }
  }

  return (
    <Modal title="Create email receiver" onClose={onClose} side={side}>
      <form className="form-grid" onSubmit={submit}>
        <FormSection title="Receiver">
          <label>
            <span>Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value.toLowerCase())}
              required
              autoFocus
              placeholder="bob"
              pattern="[a-z0-9][a-z0-9._-]*[a-z0-9]|[a-z0-9]"
            />
          </label>
        </FormSection>
        {formError ? <div className="notice error">{formError}</div> : null}
        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            <X size={16} aria-hidden="true" />
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            Create
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CreateSkillDialog({
  projects,
  selectedProjectId,
  saving,
  onClose,
  onCreate,
}: {
  projects: ProjectRecord[];
  selectedProjectId: string | null;
  saving: boolean;
  onClose: () => void;
  onCreate: (payload: { name: string; description: string; files: File[]; publicUrl: string; projectIds: string[] }) => Promise<void>;
}) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [global, setGlobal] = React.useState(false);
  const [projectIds, setProjectIds] = React.useState<string[]>(selectedProjectId ? [selectedProjectId] : []);
  const [projectsOpen, setProjectsOpen] = React.useState(false);
  const [publicUrl, setPublicUrl] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Skill name is required.");
      return;
    }
    if (!description.trim()) {
      setError("Skill description is required.");
      return;
    }
    if (!global && projectIds.length === 0) {
      setError("Select at least one project or make this skill global.");
      return;
    }
    setError(null);
    try {
      await onCreate({ name, description, files, publicUrl, projectIds: global ? [] : projectIds });
    } catch (createError) {
      setError(errorMessage(createError));
    }
  }

  function toggleProject(projectId: string, enabled: boolean) {
    setProjectIds((current) => (enabled ? uniqueStrings([...current, projectId]) : current.filter((id) => id !== projectId)));
  }

  return (
    <Modal title="Create skill" onClose={onClose} side>
      <form className="form-grid" onSubmit={submit}>
        <label>
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Brand research" required />
        </label>
        <label>
          <span>Description</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="When to use this skill and what it should do" rows={4} required />
        </label>
        <CollapsibleSection title="Projects" open={projectsOpen} onToggle={() => setProjectsOpen((value) => !value)}>
          <label className="toggle-row">
            <input type="checkbox" checked={global} onChange={(event) => setGlobal(event.target.checked)} />
            <span>Available globally</span>
          </label>
          {!global ? (
            <div className="project-checkbox-list">
              {projects.length === 0 ? <div className="structured-empty">No projects available</div> : null}
              {projects.map((project) => (
                <label className="checkbox-row" key={project.id}>
                  <input type="checkbox" checked={projectIds.includes(project.id)} onChange={(event) => toggleProject(project.id, event.target.checked)} />
                  <span>{project.name}</span>
                </label>
              ))}
            </div>
          ) : null}
        </CollapsibleSection>
        <label>
          <span>Public URL</span>
          <input value={publicUrl} onChange={(event) => setPublicUrl(event.target.value)} placeholder="https://example.com/skill.zip" inputMode="url" />
        </label>
        <div className="skill-upload-field">
          <span>Upload</span>
          <input
            ref={fileInputRef}
            className="visually-hidden-file"
            type="file"
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            {...({ webkitdirectory: "true" } as Record<string, string>)}
          />
          <button className="secondary-button" type="button" onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} aria-hidden="true" />
            {files.length > 0 ? `${files.length} files selected` : "Upload skill"}
          </button>
        </div>

        {error ? <div className="notice error">{error}</div> : null}

        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={onClose} disabled={saving}>
            <X size={16} aria-hidden="true" />
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            Create
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SkillDetailsDialog({
  skill,
  saving,
  onClose,
  onSaveMetadata,
  onCreateVersion,
  projects,
  selectedProjectId,
}: {
  skill: SkillRecord;
  saving: boolean;
  onClose: () => void;
  onSaveMetadata: (payload: { name: string; description: string; projectIds: string[] }) => Promise<void>;
  onCreateVersion: (payload: { files: File[]; publicUrl: string }) => Promise<void>;
  projects: ProjectRecord[];
  selectedProjectId: string | null;
}) {
  const isBuiltInSkill = skill.source === "anthropic";
  const initialProjectIds = skillProjectIds(skill);
  const fallbackProjectIds = initialProjectIds.length > 0 ? initialProjectIds : selectedProjectId ? [selectedProjectId] : [];
  const [name, setName] = React.useState(skill.display_title ?? "");
  const [description, setDescription] = React.useState(skill.description ?? "");
  const [global, setGlobal] = React.useState(skillIsGlobal(skill));
  const [projectIds, setProjectIds] = React.useState<string[]>(fallbackProjectIds);
  const [projectsOpen, setProjectsOpen] = React.useState(false);
  const [publicUrl, setPublicUrl] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [newVersionOpen, setNewVersionOpen] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const metadataDirty =
    name.trim() !== (skill.display_title ?? "") ||
    description.trim() !== (skill.description ?? "") ||
    (!isBuiltInSkill && (global !== skillIsGlobal(skill) || JSON.stringify(projectIds) !== JSON.stringify(fallbackProjectIds)));
  const versionDirty = !isBuiltInSkill && (files.length > 0 || Boolean(publicUrl.trim()));
  const canSave = metadataDirty || versionDirty;

  React.useEffect(() => {
    setName(skill.display_title ?? "");
    setDescription(skill.description ?? "");
    setGlobal(skillIsGlobal(skill));
    setProjectIds(fallbackProjectIds);
  }, [skill.id, skill.display_title, skill.description]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (!name.trim()) throw new Error("Skill name is required.");
      if (!isBuiltInSkill && !global && projectIds.length === 0) throw new Error("Select at least one project or make this skill global.");
      if (!canSave) return;
      if (metadataDirty) await onSaveMetadata({ name, description, projectIds: isBuiltInSkill || global ? [] : projectIds });
      if (versionDirty) {
        await onCreateVersion({ files, publicUrl });
        setFiles([]);
        setPublicUrl("");
      }
    } catch (updateError) {
      setError(errorMessage(updateError));
    }
  }

  function toggleProject(projectId: string, enabled: boolean) {
    setProjectIds((current) => (enabled ? uniqueStrings([...current, projectId]) : current.filter((id) => id !== projectId)));
  }

  return (
    <Modal title="Skill details" onClose={onClose} side>
      <form className="form-grid" onSubmit={submit}>
        <FormSection title="Skill">
          <label>
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            <span>Description</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} />
          </label>
        </FormSection>

        {isBuiltInSkill ? null : (
          <CollapsibleSection title="Projects" open={projectsOpen} onToggle={() => setProjectsOpen((value) => !value)}>
            <label className="toggle-row">
              <input type="checkbox" checked={global} onChange={(event) => setGlobal(event.target.checked)} />
              <span>Available globally</span>
            </label>
            {!global ? (
              <div className="project-checkbox-list">
                {projects.length === 0 ? <div className="structured-empty">No projects available</div> : null}
                {projects.map((project) => (
                  <label className="checkbox-row" key={project.id}>
                    <input type="checkbox" checked={projectIds.includes(project.id)} onChange={(event) => toggleProject(project.id, event.target.checked)} />
                    <span>{project.name}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </CollapsibleSection>
        )}

        {isBuiltInSkill ? null : (
          <CollapsibleSection title="New version" open={newVersionOpen} onToggle={() => setNewVersionOpen((value) => !value)}>
            <label>
              <span>Public URL</span>
              <input value={publicUrl} onChange={(event) => setPublicUrl(event.target.value)} placeholder="https://example.com/skill.zip" inputMode="url" />
            </label>
            <div className="skill-upload-field">
              <span>Upload</span>
              <input
                ref={fileInputRef}
                className="visually-hidden-file"
                type="file"
                multiple
                onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                {...({ webkitdirectory: "true" } as Record<string, string>)}
              />
              <button className="secondary-button" type="button" onClick={() => fileInputRef.current?.click()}>
                <Upload size={16} aria-hidden="true" />
                {files.length > 0 ? `${files.length} files selected` : "Upload skill"}
              </button>
            </div>
          </CollapsibleSection>
        )}

        <CollapsibleSection title="Details" open={detailsOpen} onToggle={() => setDetailsOpen((value) => !value)}>
          <div className="details-info-grid">
            <InfoRow icon={<Info size={15} />} label="Skill ID" value={skill.id} />
            <InfoRow icon={<Archive size={15} />} label="Source" value={skill.source} />
            <InfoRow icon={<Calendar size={15} />} label="Version" value={isBuiltInSkill && !skill.latest_version ? "Built-in" : (skill.latest_version ?? "No version")} />
          </div>
        </CollapsibleSection>

        {error ? <div className="notice error">{error}</div> : null}

        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={onClose} disabled={saving}>
            <X size={16} aria-hidden="true" />
            Close
          </button>
          <button className="primary-button" type="submit" disabled={saving || !canSave}>
            {saving ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CreateSecretDialog({
  vault,
  saving,
  onClose,
  onCreate,
}: {
  vault: VaultRecord;
  saving: boolean;
  onClose: () => void;
  onCreate: (payload: JsonObject) => Promise<void>;
}) {
  const [kind, setKind] = React.useState<SecretKind>("static_bearer");
  const [displayName, setDisplayName] = React.useState("");
  const [mcpServerUrl, setMcpServerUrl] = React.useState("");
  const [token, setToken] = React.useState("");
  const [secretName, setSecretName] = React.useState("");
  const [secretValue, setSecretValue] = React.useState("");
  const [allowedHosts, setAllowedHosts] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    try {
      const payload: JsonObject = {
        display_name: displayName.trim() || null,
        auth:
          kind === "static_bearer"
            ? {
                type: "static_bearer",
                mcp_server_url: mcpServerUrl.trim(),
                token,
              }
            : {
                type: "environment_variable",
                secret_name: secretName.trim(),
                secret_value: secretValue,
                allowed_hosts: allowedHosts
                  .split(",")
                  .map((host) => host.trim())
                  .filter(Boolean),
              },
      };
      await onCreate(payload);
    } catch (submitError) {
      setFormError(errorMessage(submitError));
    }
  }

  return (
    <Modal title="Add secret" onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <FormSection title={vault.display_name}>
          <label>
            <span>Type</span>
            <select value={kind} onChange={(event) => setKind(event.target.value as SecretKind)}>
              <option value="static_bearer">Static bearer</option>
              <option value="environment_variable">Environment variable</option>
            </select>
          </label>
          <label>
            <span>Display name</span>
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Optional" />
          </label>
        </FormSection>

        {kind === "static_bearer" ? (
          <FormSection title="Bearer credential">
            <label>
              <span>MCP server URL</span>
              <input value={mcpServerUrl} onChange={(event) => setMcpServerUrl(event.target.value)} placeholder="https://example.com/mcp/" required />
            </label>
            <label>
              <span>Bearer token</span>
              <input value={token} onChange={(event) => setToken(event.target.value)} type="password" required />
            </label>
          </FormSection>
        ) : (
          <FormSection title="Environment variable">
            <label>
              <span>Secret name</span>
              <input value={secretName} onChange={(event) => setSecretName(event.target.value)} placeholder="API_KEY" required />
            </label>
            <label>
              <span>Secret value</span>
              <input value={secretValue} onChange={(event) => setSecretValue(event.target.value)} type="password" required />
            </label>
            <label>
              <span>Allowed hosts</span>
              <input value={allowedHosts} onChange={(event) => setAllowedHosts(event.target.value)} placeholder="api.example.com, *.example.com" />
            </label>
          </FormSection>
        )}

        {formError ? <div className="notice error">{formError}</div> : null}
        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            <X size={16} aria-hidden="true" />
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            Add secret
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CreateMcpServerDialog({
  server,
  projects,
  selectedProjectId,
  saving,
  onClose,
  onSubmit,
  side,
}: {
  server?: RegisteredMcpServer;
  projects: ProjectRecord[];
  selectedProjectId: string | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: JsonObject) => Promise<void>;
  side?: boolean;
}) {
  const editing = Boolean(server);
  const initialProjectIds = selectedProjectId ? [selectedProjectId] : [];
  const [name, setName] = React.useState(server?.name ?? "");
  const [description, setDescription] = React.useState(server?.description ?? "");
  const [url, setUrl] = React.useState(server?.url ?? "");
  const [iconUrl, setIconUrl] = React.useState(server?.icon_data_url ?? "");
  const [authKind, setAuthKind] = React.useState<McpAuthEditKind>(editing ? "unchanged" : "no_auth");
  const [authenticationOpen, setAuthenticationOpen] = React.useState(false);
  const [token, setToken] = React.useState("");
  const [environmentVariables, setEnvironmentVariables] = React.useState<Array<{ id: string; secretName: string; secretValue: string }>>([
    { id: crypto.randomUUID(), secretName: "", secretValue: "" },
  ]);
  const [formError, setFormError] = React.useState<string | null>(null);

  function updateEnvironmentVariable(id: string, patch: Partial<{ secretName: string; secretValue: string }>) {
    setEnvironmentVariables((current) => current.map((variable) => (variable.id === id ? { ...variable, ...patch } : variable)));
  }

  function removeEnvironmentVariable(id: string) {
    setEnvironmentVariables((current) => (current.length === 1 ? current : current.filter((variable) => variable.id !== id)));
  }

  function addEnvironmentVariable() {
    setEnvironmentVariables((current) => [...current, { id: crypto.randomUUID(), secretName: "", secretValue: "" }]);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    try {
      const payload: JsonObject = {
        name: name.trim(),
        description: nullableText(description),
        url: url.trim(),
        icon_data_url: nullableText(iconUrl),
        project_ids: initialProjectIds,
      };
      if (initialProjectIds.length === 0) {
        throw new Error("Select a project before creating an MCP server.");
      }
      if (authKind !== "unchanged") {
        payload.auth =
          authKind === "no_auth"
            ? { type: "no_auth" }
            : authKind === "static_bearer"
              ? { type: "static_bearer", token }
              : {
                  type: "environment_variable",
                  variables: environmentVariables.map((variable) => ({
                    secret_name: variable.secretName.trim(),
                    secret_value: variable.secretValue,
                  })),
                };
      }
      await onSubmit(payload);
    } catch (submitError) {
      setFormError(errorMessage(submitError));
    }
  }

  return (
    <Modal title={editing ? "Edit MCP server" : "Add MCP server"} onClose={onClose} side={side}>
      <form className="form-grid" onSubmit={submit}>
        <FormSection title="Basics">
          <label>
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            <span>Description</span>
            <input value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <label>
            <span>URL</span>
            <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/mcp" required />
          </label>
          <label>
            <span>Logo URL</span>
            <input type="url" value={iconUrl} onChange={(event) => setIconUrl(event.target.value)} placeholder="https://example.com/logo.png" />
          </label>
        </FormSection>

        <CollapsibleSection title="Authentication" open={authenticationOpen} onToggle={() => setAuthenticationOpen((value) => !value)}>
          <label>
            <span>Type</span>
            <select value={authKind} onChange={(event) => setAuthKind(event.target.value as McpAuthEditKind)}>
              {editing ? <option value="unchanged">Keep current auth ({mcpAuthLabel(server?.auth_type ?? "no_auth")})</option> : null}
              <option value="no_auth">No auth</option>
              <option value="static_bearer">Static bearer</option>
              <option value="environment_variable">Environment value</option>
            </select>
          </label>
          {authKind === "static_bearer" ? (
            <label>
              <span>Bearer token</span>
              <input value={token} onChange={(event) => setToken(event.target.value)} type="password" required />
            </label>
          ) : authKind === "environment_variable" ? (
            <div className="structured-editor">
              <div className="structured-editor-head">
                <span>Environment variables</span>
                <button className="secondary-button compact-button" type="button" onClick={addEnvironmentVariable}>
                  <Plus size={15} aria-hidden="true" />
                  Add variable
                </button>
              </div>
              {environmentVariables.map((variable) => (
                <div className="structured-row mcp-env-row" key={variable.id}>
                  <label>
                    <span>Name</span>
                    <input value={variable.secretName} onChange={(event) => updateEnvironmentVariable(variable.id, { secretName: event.target.value })} placeholder="API_KEY" required />
                  </label>
                  <label>
                    <span>Value</span>
                    <input value={variable.secretValue} onChange={(event) => updateEnvironmentVariable(variable.id, { secretValue: event.target.value })} type="password" required />
                  </label>
                  <button className="icon-button row-remove-button" type="button" onClick={() => removeEnvironmentVariable(variable.id)} disabled={environmentVariables.length === 1} title="Remove variable">
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </CollapsibleSection>

        {formError ? <div className="notice error">{formError}</div> : null}

        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            <X size={16} aria-hidden="true" />
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? <Loader2 className="spin" size={16} aria-hidden="true" /> : editing ? <Save size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            {editing ? "Save" : "Add"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EnvironmentDialog({
  environment,
  saving,
  onClose,
  onSubmit,
}: {
  environment?: AnthropicEnvironment;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: JsonObject) => Promise<void>;
}) {
  const editing = Boolean(environment);
  const initialKind = environment?.config.type === "self_hosted" ? "self_hosted" : "cloud";
  const [name, setName] = React.useState(environment?.name ?? "");
  const [description, setDescription] = React.useState(environment?.description ?? "");
  const [kind, setKind] = React.useState<EnvironmentKind>(initialKind);
  const [scope, setScope] = React.useState<"organization" | "account">(environment?.scope ?? "account");
  const [config, setConfig] = React.useState(formatJson(environment?.config ?? defaultEnvironmentConfig("cloud")));
  const [metadata, setMetadata] = React.useState(formatJson(environment?.metadata ?? {}));
  const [formError, setFormError] = React.useState<string | null>(null);

  function changeKind(nextKind: EnvironmentKind) {
    setKind(nextKind);
    setConfig(formatJson(defaultEnvironmentConfig(nextKind)));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    try {
      const payload: JsonObject = {
        name: name.trim(),
        config: parseJsonObject(config, "Config"),
      };
      if (description.trim()) {
        payload.description = description.trim();
      } else if (editing) {
        payload.description = null;
      }
      const parsedMetadata = parseJsonObject(metadata, "Metadata");
      if (editing || Object.keys(parsedMetadata).length > 0) payload.metadata = parsedMetadata;
      if (kind === "self_hosted") payload.scope = scope;
      await onSubmit(payload);
    } catch (submitError) {
      setFormError(errorMessage(submitError));
    }
  }

  return (
    <Modal title={editing ? "Edit environment" : "Create environment"} onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <FormSection title="Basics">
          <label>
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            <span>Description</span>
            <input value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <label>
            <span>Type</span>
            <select value={kind} onChange={(event) => changeKind(event.target.value as EnvironmentKind)}>
              <option value="cloud">Cloud</option>
              <option value="self_hosted">Self-hosted</option>
            </select>
          </label>
          {kind === "self_hosted" ? (
            <label>
              <span>Scope</span>
              <select value={scope} onChange={(event) => setScope(event.target.value as "organization" | "account")}>
                <option value="account">Account</option>
                <option value="organization">Organization</option>
              </select>
            </label>
          ) : null}
        </FormSection>
        <FormSection title="Configuration">
          <JsonEditor label="Config" value={config} onChange={setConfig} rows={8} />
          <JsonEditor label="Metadata" value={metadata} onChange={setMetadata} rows={4} />
        </FormSection>
        {formError ? <div className="notice error">{formError}</div> : null}
        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            <X size={16} aria-hidden="true" />
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? <Loader2 className="spin" size={16} aria-hidden="true" /> : editing ? <Save size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            {editing ? "Save" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CreateDeploymentDialog({
  agents,
  environments,
  vaults,
  saving,
  onClose,
  onCreate,
}: {
  agents: AgentRecord[];
  environments: AnthropicEnvironment[];
  vaults: VaultRecord[];
  saving: boolean;
  onClose: () => void;
  onCreate: (payload: JsonObject) => Promise<void>;
}) {
  return (
    <DeploymentFormDialog
      title="Create deployment"
      submitLabel="Create"
      agents={agents}
      environments={environments}
      vaults={vaults}
      saving={saving}
      onClose={onClose}
      onSubmit={onCreate}
    />
  );
}

function DeploymentDetailsDialog({
  deployment,
  agents,
  environments,
  vaults,
  saving,
  onClose,
  onUpdate,
  onDelete,
}: {
  deployment: AnthropicDeployment;
  agents: AgentRecord[];
  environments: AnthropicEnvironment[];
  vaults: VaultRecord[];
  saving: boolean;
  onClose: () => void;
  onUpdate: (payload: JsonObject) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  return (
    <DeploymentFormDialog
      title="Deployment details"
      submitLabel="Save"
      deployment={deployment}
      agents={agents}
      environments={environments}
      vaults={vaults}
      saving={saving}
      onClose={onClose}
      onSubmit={onUpdate}
      onDelete={onDelete}
    />
  );
}

function DeploymentFormDialog({
  title,
  submitLabel,
  deployment,
  agents,
  environments,
  vaults,
  saving,
  onClose,
  onSubmit,
  onDelete,
}: {
  title: string;
  submitLabel: string;
  deployment?: AnthropicDeployment;
  agents: AgentRecord[];
  environments: AnthropicEnvironment[];
  vaults: VaultRecord[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: JsonObject) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const initialSchedule = deploymentScheduleDraft(deployment?.schedule);
  const [name, setName] = React.useState(deployment?.name ?? "");
  const [description, setDescription] = React.useState(deployment?.description ?? "");
  const [agentId, setAgentId] = React.useState(deployment ? deploymentAgentId(deployment) : (agents[0]?.id ?? ""));
  const [environmentId, setEnvironmentId] = React.useState(deployment?.environment_id ?? environments[0]?.id ?? "");
  const [initialMessage, setInitialMessage] = React.useState(deploymentInitialMessage(deployment?.initial_events));
  const [vaultIds, setVaultIds] = React.useState<string[]>(deployment?.vault_ids ?? vaults.map((vault) => vault.id));
  const vaultSelectionInitializedRef = React.useRef(Boolean(deployment) || vaults.length > 0);
  const [scheduleEnabled, setScheduleEnabled] = React.useState(Boolean(deployment?.schedule));
  const [scheduleMode, setScheduleMode] = React.useState<ScheduleMode>(initialSchedule.mode);
  const [scheduleInterval, setScheduleInterval] = React.useState(initialSchedule.interval);
  const [scheduleMinute, setScheduleMinute] = React.useState(initialSchedule.minute);
  const [scheduleHour, setScheduleHour] = React.useState(initialSchedule.hour);
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = React.useState(initialSchedule.dayOfWeek);
  const [scheduleExpression, setScheduleExpression] = React.useState(initialSchedule.expression);
  const [scheduleTimezone, setScheduleTimezone] = React.useState(initialSchedule.timezone);
  const [resources, setResources] = React.useState(formatJson(deployment?.resources ?? []));
  const [metadata, setMetadata] = React.useState(formatJson(deployment?.metadata ?? {}));
  const [formError, setFormError] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const scheduleDraft: ScheduleDraft = {
    mode: scheduleMode,
    interval: scheduleInterval,
    minute: scheduleMinute,
    hour: scheduleHour,
    dayOfWeek: scheduleDayOfWeek,
    expression: scheduleExpression,
    timezone: scheduleTimezone,
  };

  React.useEffect(() => {
    if (deployment || vaultSelectionInitializedRef.current || vaults.length === 0) return;
    setVaultIds(vaults.map((vault) => vault.id));
    vaultSelectionInitializedRef.current = true;
  }, [deployment, vaults]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    try {
      if (!name.trim()) throw new Error("Deployment name is required.");
      if (!agentId) throw new Error("Agent is required.");
      if (!environmentId) throw new Error("Environment is required.");
      if (!initialMessage.trim()) throw new Error("Initial message is required.");

      const payload: JsonObject = {
        name: name.trim(),
        description: nullableText(description),
        agent: agentId,
        environment_id: environmentId,
        initial_events: deploymentInitialEvents(initialMessage),
        vault_ids: vaultIds,
        resources: parseJsonArray(resources, "Resources"),
        metadata: parseJsonObject(metadata, "Metadata"),
        schedule: scheduleEnabled
          ? {
              type: "cron",
              expression: cronExpressionForSchedule(scheduleDraft),
              timezone: scheduleTimezone.trim(),
            }
          : null,
      };
      await onSubmit(payload);
    } catch (submitError) {
      setFormError(errorMessage(submitError));
    }
  }

  return (
    <Modal title={title} onClose={onClose} wide>
      <form className="form-grid" onSubmit={submit}>
        <FormSection title="Basics">
          <div className="form-grid two">
            <label>
              <span>Name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label>
              <span>Status</span>
              <input value={deployment?.status ?? "new"} disabled />
            </label>
          </div>
          <label>
            <span>Description</span>
            <input value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
        </FormSection>

        <FormSection title="Runtime">
          <div className="form-grid two">
            <label>
              <span>Agent</span>
              <select value={agentId} onChange={(event) => setAgentId(event.target.value)} required>
                {agents.map((record) => (
                  <option value={record.id} key={record.id}>
                    {record.agent.name} · v{record.agent.version}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Environment</span>
              <select value={environmentId} onChange={(event) => setEnvironmentId(event.target.value)} required>
                {environments.map((environment) => (
                  <option value={environment.id} key={environment.id}>
                    {environment.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <fieldset className="vault-selector">
            <legend>Vaults</legend>
            {vaults.length === 0 ? (
              <span className="vault-selector-empty">No vaults available</span>
            ) : (
              <div className="vault-selector-options">
                {vaults.map((vault) => (
                  <label className="vault-checkbox" key={vault.id}>
                    <input type="checkbox" checked={vaultIds.includes(vault.id)} onChange={() => setVaultIds((current) => toggleArrayValue(current, vault.id))} />
                    <span>{vault.display_name}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        </FormSection>

        <FormSection title="Initial event">
          <label>
            <span>User message</span>
            <textarea value={initialMessage} onChange={(event) => setInitialMessage(event.target.value)} rows={5} required />
          </label>
        </FormSection>

        <FormSection title="Schedule">
          <label className="check-row">
            <input type="checkbox" checked={scheduleEnabled} onChange={(event) => setScheduleEnabled(event.target.checked)} />
            <span>Run on a schedule</span>
          </label>
          {scheduleEnabled ? (
            <div className="schedule-builder">
              <label>
                <span>Repeat</span>
                <select value={scheduleMode} onChange={(event) => setScheduleMode(event.target.value as ScheduleMode)}>
                  <option value="hours">Every x hours</option>
                  <option value="days">Every x days</option>
                  <option value="weeks">Every x weeks</option>
                  <option value="cron">Custom cron</option>
                </select>
              </label>
              {scheduleMode === "cron" ? (
                <label>
                  <span>Cron expression</span>
                  <input value={scheduleExpression} onChange={(event) => setScheduleExpression(event.target.value)} placeholder="0 9 * * 1-5" required />
                </label>
              ) : (
                <>
                  <label>
                    <span>Every</span>
                    <input type="number" min={1} max={scheduleIntervalMax(scheduleMode)} value={scheduleInterval} onChange={(event) => setScheduleInterval(numberFromInput(event.target.value, 1))} required />
                  </label>
                  <label>
                    <span>Unit</span>
                    <input value={scheduleMode === "hours" ? "hours" : scheduleMode === "days" ? "days" : "weeks"} disabled />
                  </label>
                  {scheduleMode !== "hours" ? (
                    <label>
                      <span>At</span>
                      <input type="time" value={timeInputValue(scheduleHour, scheduleMinute)} onChange={(event) => {
                        const time = parseTimeInput(event.target.value);
                        setScheduleHour(time.hour);
                        setScheduleMinute(time.minute);
                      }} />
                    </label>
                  ) : (
                    <label>
                      <span>Minute</span>
                      <input type="number" min={0} max={59} value={scheduleMinute} onChange={(event) => setScheduleMinute(numberFromInput(event.target.value, 0))} required />
                    </label>
                  )}
                  {scheduleMode === "weeks" ? (
                    <label>
                      <span>Day</span>
                      <select value={scheduleDayOfWeek} onChange={(event) => setScheduleDayOfWeek(numberFromInput(event.target.value, 1))}>
                        {weekdays().map((day) => (
                          <option value={day.value} key={day.value}>
                            {day.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </>
              )}
              <label>
                <span>Timezone</span>
                <input value={scheduleTimezone} onChange={(event) => setScheduleTimezone(event.target.value)} placeholder="UTC" required />
              </label>
              <div className="schedule-summary">
                <span>Cron</span>
                <strong>{cronExpressionPreview(scheduleDraft)}</strong>
              </div>
            </div>
          ) : null}
        </FormSection>

        <FormSection title="Advanced">
          <JsonEditor label="Resources" value={resources} onChange={setResources} rows={6} />
          <JsonEditor label="Metadata" value={metadata} onChange={setMetadata} rows={4} />
        </FormSection>

        {deployment ? (
          <aside className="deployment-summary">
            <InfoRow icon={<Rocket size={15} />} label="ID" value={deployment.id} />
            <InfoRow icon={<Calendar size={15} />} label="Created" value={formatDateTime(deployment.created_at)} />
            <InfoRow icon={<Calendar size={15} />} label="Updated" value={formatDateTime(deployment.updated_at)} />
          </aside>
        ) : null}

        {formError ? <div className="notice error">{formError}</div> : null}

        <div className="dialog-actions">
          {onDelete ? (
            <button className="danger-button" type="button" onClick={() => setConfirmDelete(true)} disabled={saving}>
              {saving ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Archive size={16} aria-hidden="true" />}
              Delete
            </button>
          ) : null}
          <button className="secondary-button" type="button" onClick={onClose}>
            <X size={16} aria-hidden="true" />
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
            {submitLabel}
          </button>
        </div>
      </form>
      {confirmDelete && onDelete ? (
        <ConfirmDialog
          title="Delete deployment"
          message={`Archive ${deployment?.name ?? "this deployment"}?`}
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            void onDelete().catch((deleteError) => setFormError(errorMessage(deleteError)));
          }}
        />
      ) : null}
    </Modal>
  );
}

function CreateAgentProposalDialog({
  auth,
  projectId,
  registeredMcpServers,
  title = "Create agent",
  integrations,
  onAddIntegration,
  onClose,
  onCreated,
  onGenerate,
}: {
  auth: AuthSession;
  projectId: string;
  registeredMcpServers: RegisteredMcpServer[];
  title?: string;
  integrations: IntegrationRecord[];
  onAddIntegration: (integration: IntegrationRecord) => void;
  onClose: () => void;
  onCreated: (agent: Agent) => void;
  onGenerate: (projectId: string, prompt: string) => Promise<GeneratedAgentSpec>;
}) {
  const [prompt, setPrompt] = React.useState("");
  const [draft, setDraft] = React.useState<GeneratedAgentSpec | null>(null);
  const [mcpSetupOpen, setMcpSetupOpen] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function generate(promptToGenerate = prompt) {
    const trimmedPrompt = promptToGenerate.trim();
    if (!trimmedPrompt) return;
    setError(null);
    setGenerating(true);
    try {
      const generated = await onGenerate(projectId, trimmedPrompt);
      setDraft({
        ...generated,
        mcp_server_ids: generated.mcp_server_ids ?? [],
        required_integration_ids: generated.required_integration_ids ?? [],
      });
    } catch (generateError) {
      setError(errorMessage(generateError));
    } finally {
      setGenerating(false);
    }
  }

  function updateDraft(change: Partial<GeneratedAgentSpec>) {
    setDraft((current) => (current ? { ...current, ...change } : current));
  }

  const integrationById = React.useMemo(() => new Map(integrations.map((integration) => [integration.id, integration])), [integrations]);
  const installedIntegrationServerIdsByIntegrationId = React.useMemo(() => {
    const installed = new Map<string, string[]>();
    integrations.forEach((integration) => {
      const serverIds = registeredMcpServers
        .filter((server) => mcpServerMatchesIntegrationTemplate(server, integration))
        .map((server) => server.id);
      if (serverIds.length > 0) installed.set(integration.id, serverIds);
    });
    return installed;
  }, [integrations, registeredMcpServers]);
  const missingRequiredIntegrationIds = React.useMemo(
    () => uniqueStrings(draft?.required_integration_ids ?? []).filter((id) => !installedIntegrationServerIdsByIntegrationId.has(id)),
    [draft?.required_integration_ids, installedIntegrationServerIdsByIntegrationId],
  );
  const missingRequiredIntegrations = React.useMemo(
    () => missingRequiredIntegrationIds.map((id) => integrationById.get(id)).filter((integration): integration is IntegrationRecord => Boolean(integration)),
    [integrationById, missingRequiredIntegrationIds],
  );
  const requiredInstalledMcpServers = React.useMemo(
    () => uniqueStrings(draft?.mcp_server_ids ?? [])
      .map((id) => registeredMcpServers.find((server) => server.id === id))
      .filter((server): server is RegisteredMcpServer => Boolean(server)),
    [draft?.mcp_server_ids, registeredMcpServers],
  );
  const requiredInstalledMcpRows = React.useMemo(
    () => requiredInstalledMcpServers.map((server) => ({
      server,
      integration: integrations.find((integration) => mcpServerMatchesIntegrationTemplate(server, integration)) ?? null,
    })),
    [integrations, requiredInstalledMcpServers],
  );

  React.useEffect(() => {
    setDraft((current) => {
      if (!current || current.required_integration_ids.length === 0) return current;
      const installedRequiredIds = current.required_integration_ids.filter((id) => (installedIntegrationServerIdsByIntegrationId.get(id)?.length ?? 0) > 0);
      if (installedRequiredIds.length === 0) return current;
      const installedRequiredIdSet = new Set(installedRequiredIds);
      const installedMcpServerIds = installedRequiredIds.flatMap((id) => installedIntegrationServerIdsByIntegrationId.get(id) ?? []);
      return {
        ...current,
        mcp_server_ids: uniqueStrings([...current.mcp_server_ids, ...installedMcpServerIds]),
        required_integration_ids: current.required_integration_ids.filter((id) => !installedRequiredIdSet.has(id)),
      };
    });
  }, [installedIntegrationServerIdsByIntegrationId]);

  async function create() {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      setError("Agent name is required.");
      return;
    }
    if (missingRequiredIntegrationIds.length > 0) {
      setError("Install required integrations before creating this agent.");
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const selectedMcpServers = serializeMcpServerDrafts(
        draft.mcp_server_ids.map((registryId) => ({ id: registryId, registryId, name: "", url: "" })),
        registeredMcpServers,
      );
      const response = await apiFetch<{ agent: Agent }>("/agents", auth, {
        method: "POST",
        body: JSON.stringify({
          name,
          description: draft.description.trim() || undefined,
          system: draft.system_prompt.trim() || undefined,
          model: defaultAgentModel,
          project_ids: [projectId],
          global: false,
          mcp_servers: selectedMcpServers,
          tools: serializeMcpToolsets(selectedMcpServers),
        }),
      });
      await onCreated(response.agent);
    } catch (createError) {
      setError(errorMessage(createError));
    } finally {
      setCreating(false);
    }
  }

  if (generating) {
    return (
      <Modal title="Create agent" onClose={onClose} plainHeader>
        <div className="project-crafting">
          <div className="project-crafting-icon"><Bot size={42} aria-hidden="true" /></div>
          <strong>Crafting...</strong>
        </div>
      </Modal>
    );
  }

  if (mcpSetupOpen && draft) {
    return (
      <Modal title="MCP Servers" onClose={onClose} plainHeader className="agent-mcp-setup-modal">
        <div className="agent-mcp-setup-layout">
          <div className="agent-mcp-setup-scroll">
            <div className="agent-mcp-setup-content">
              <section className="agent-mcp-setup-section">
                <h2>Required integrations</h2>
                {requiredInstalledMcpRows.length === 0 && missingRequiredIntegrations.length === 0 ? (
                  <div className="structured-empty">
                    {missingRequiredIntegrationIds.length === 0 ? "No required integrations were suggested for this agent." : "Required integration templates are not available yet."}
                  </div>
                ) : (
                  <div className="agent-mcp-integration-list">
                    {requiredInstalledMcpRows.map(({ server, integration }) => (
                      <div className="agent-mcp-integration-option installed" key={`installed-${server.id}`}>
                        <span className="agent-mcp-integration-icon">
                          {integration?.logo_data_url ? <img src={integration.logo_data_url} alt="" /> : <McpServerIcon server={server} fallbackSize={18} />}
                        </span>
                        <span>
                          <strong>{integration?.name ?? server.name}</strong>
                          <small>{integration ? `Installed MCP: ${server.name}` : server.description || server.url}</small>
                        </span>
                        <span className="agent-mcp-installed-badge"><Check size={14} aria-hidden="true" /> Installed</span>
                      </div>
                    ))}
                    {missingRequiredIntegrations.map((integration) => (
                      <button className="agent-mcp-integration-option required" type="button" onClick={() => onAddIntegration(integration)} key={integration.id}>
                        <span className="agent-mcp-integration-icon">
                          {integration.logo_data_url ? <img src={integration.logo_data_url} alt="" /> : <Rocket size={18} aria-hidden="true" />}
                        </span>
                        <span>
                          <strong>{integration.name}</strong>
                          <small>{integration.description || integration.mcp_server_url}</small>
                        </span>
                        <span className="agent-mcp-required-badge">Install required</span>
                      </button>
                    ))}
                  </div>
                )}
                {missingRequiredIntegrationIds.length > missingRequiredIntegrations.length ? (
                  <div className="notice warning">Some required integrations are not available yet.</div>
                ) : null}
              </section>
            </div>
          </div>

          <div className="agent-mcp-setup-footer">
            {missingRequiredIntegrationIds.length > 0 ? <div className="notice warning">Install required integrations before creating this agent.</div> : null}
            {error ? <div className="notice error">{error}</div> : null}
            <div className="dialog-actions">
              <button className="secondary-button" type="button" onClick={() => setMcpSetupOpen(false)} disabled={creating}>
                Back
              </button>
              <button className="primary-button" type="button" onClick={() => void create()} disabled={creating || !draft.name.trim() || missingRequiredIntegrationIds.length > 0}>
                {creating ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
                Create agent
              </button>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  if (draft) {
    return (
      <Modal title="Agent summary" onClose={onClose} plainHeader>
        <div className="agent-proposal-form">
          <label>
            <span>Name</span>
            <input value={draft.name} onChange={(event) => updateDraft({ name: event.target.value })} autoFocus />
          </label>
          <label>
            <span>Description</span>
            <textarea value={draft.description} onChange={(event) => updateDraft({ description: event.target.value })} rows={3} />
          </label>
          <label>
            <span>System prompt</span>
            <textarea value={draft.system_prompt} onChange={(event) => updateDraft({ system_prompt: event.target.value })} rows={7} />
          </label>
          {error ? <div className="notice error">{error}</div> : null}
          <div className="dialog-actions">
            <button className="secondary-button" type="button" onClick={() => { setDraft(null); setError(null); }} disabled={creating}>Back</button>
            <button className="primary-button" type="button" onClick={() => setMcpSetupOpen(true)} disabled={creating || !draft.name.trim()}>
              <ChevronRight size={16} aria-hidden="true" />
              Next
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={title} onClose={onClose} plainHeader>
      <div className="agent-proposal-start">
        <label>
          <span>What do you want your agent to do?</span>
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Describe the job, context, and desired outcome." rows={5} autoFocus />
        </label>
        {error ? <div className="notice error">{error}</div> : null}
        <div className="dialog-actions">
          <button className="primary-button" type="button" onClick={() => void generate()} disabled={!prompt.trim()}>
            <ChevronRight size={16} aria-hidden="true" />
            Next
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CreateAgentDialog({
  auth,
  projectId,
  projects,
  agents,
  registeredMcpServers,
  projectCanEdit,
  workspaceRole,
  onClose,
  onCreated,
  side,
}: {
  auth: AuthSession;
  projectId: string;
  projects: ProjectRecord[];
  agents: AgentRecord[];
  registeredMcpServers: RegisteredMcpServer[];
  projectCanEdit?: boolean;
  workspaceRole: WorkspaceRole;
  onClose: () => void;
  onCreated: (agent: Agent) => void;
  side?: boolean;
}) {
  const [name, setName] = React.useState("");
  const [model, setModel] = React.useState(defaultAgentModel);
  const [description, setDescription] = React.useState("");
  const [system, setSystem] = React.useState("");
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [skills, setSkills] = React.useState<SkillDraft[]>([]);
  const [mcpServers, setMcpServers] = React.useState<McpServerDraft[]>([]);
  const [subAgents, setSubAgents] = React.useState<SubAgentDraft[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmClose, setConfirmClose] = React.useState(false);

  const dirty =
    name.trim() !== "" ||
    model.trim() !== defaultAgentModel ||
    description.trim() !== "" ||
    system.trim() !== "" ||
    skills.length > 0 ||
    mcpServers.length > 0 ||
    subAgents.length > 0;

  function requestClose() {
    if (dirty && !saving) {
      setConfirmClose(true);
      return;
    }
    onClose();
  }

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        requestClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dirty, saving]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload: JsonObject = { name: name.trim(), model: model.trim(), global: false, project_ids: [projectId] };
      if (description.trim()) payload.description = description.trim();
      if (system.trim()) payload.system = system;
      if (advancedOpen) {
        payload.skills = serializeSkillDrafts(skills);
        const selectedMcpServers = serializeMcpServerDrafts(mcpServers, registeredMcpServers);
        payload.mcp_servers = selectedMcpServers;
        payload.tools = serializeMcpToolsets(selectedMcpServers);
        const multiagent = serializeSubAgents(subAgents);
        if (multiagent) payload.multiagent = multiagent;
      }

      const response = await apiFetch<{ agent: Agent }>("/agents", auth, { method: "POST", body: JSON.stringify(payload) });
      onCreated(response.agent);
    } catch (createError) {
      setError(errorMessage(createError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Create agent" onClose={requestClose} side={side}>
      <form className="form-grid" onSubmit={submit}>
        <FormSection title="Agent">
          <label>
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            <span>Description</span>
            <input value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <label>
            <span>System prompt</span>
            <textarea value={system} onChange={(event) => setSystem(event.target.value)} rows={5} />
          </label>
        </FormSection>

        <CollapsibleSection title="Configuration" open={advancedOpen} onToggle={() => setAdvancedOpen((value) => !value)}>
          <label>
            <span>Model</span>
            <AgentModelSelect value={model} onChange={setModel} required />
          </label>
          <div className="advanced-fields">
            <SkillEditor skills={skills} onChange={setSkills} />
            <SubAgentEditor subAgents={subAgents} agents={agents} onChange={setSubAgents} />
            <McpServerEditor servers={mcpServers} registeredServers={registeredMcpServers} onChange={setMcpServers} />
          </div>
        </CollapsibleSection>

        {error ? <div className="notice error">{error}</div> : null}

        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={requestClose}>
            <X size={16} aria-hidden="true" />
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            Create
          </button>
        </div>
      </form>
      {confirmClose ? (
        <ConfirmDialog title="Discard changes" message="Close this window and discard the unsaved agent draft?" confirmLabel="Discard" onCancel={() => setConfirmClose(false)} onConfirm={onClose} />
      ) : null}
    </Modal>
  );
}

function AgentDetailsDialog({
  record,
  auth,
  agents,
  members,
  registeredMcpServers,
  projectCanEdit,
  projects,
  selectedProjectId,
  workspaceRole,
  onClose,
  onChanged,
  side,
}: {
  record: AgentRecord;
  auth: AuthSession;
  agents: AgentRecord[];
  members: Member[];
  registeredMcpServers: RegisteredMcpServer[];
  projectCanEdit?: boolean;
  projects: ProjectRecord[];
  selectedProjectId: string | null;
  workspaceRole: WorkspaceRole;
  onClose: () => void;
  onChanged: () => void;
  side?: boolean;
}) {
  const agent = record.agent;
  const initialProjectIds = React.useMemo(() => agentProjectIdsFromMetadata(agent.metadata), [agent.metadata]);
  const fallbackProjectIds = initialProjectIds.length > 0 ? initialProjectIds : selectedProjectId ? [selectedProjectId] : [];
  const initialGlobal = initialProjectIds.length === 0;
  const canEdit = workspaceRole === "admin" || (!initialGlobal && projectCanEdit === true);
  const initialMcpServers = React.useMemo(() => mcpServerDraftsFromAgent(agent.mcp_servers, registeredMcpServers), [agent.mcp_servers, registeredMcpServers]);
  const initialSkills = React.useMemo(() => skillDraftsFromAgent(agent.skills), [agent.skills]);
  const initialSubAgents = React.useMemo(() => subAgentDraftsFromAgent(agent.multiagent), [agent.multiagent]);
  const subAgentOptions = React.useMemo(() => agents.filter((candidate) => candidate.id !== agent.id), [agents, agent.id]);
  const [name, setName] = React.useState(agent.name);
  const [model, setModel] = React.useState(modelValue(agent.model));
  const [description, setDescription] = React.useState(agent.description ?? "");
  const [system, setSystem] = React.useState(agent.system ?? "");
  const [globalAgent, setGlobalAgent] = React.useState(initialGlobal);
  const [projectIds, setProjectIds] = React.useState<string[]>(fallbackProjectIds);
  const [projectsOpen, setProjectsOpen] = React.useState(false);
  const [skills, setSkills] = React.useState<SkillDraft[]>(initialSkills);
  const [mcpServers, setMcpServers] = React.useState<McpServerDraft[]>(initialMcpServers);
  const [subAgents, setSubAgents] = React.useState<SubAgentDraft[]>(initialSubAgents);
  const [configurationOpen, setConfigurationOpen] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmClose, setConfirmClose] = React.useState(false);
  const [confirmRemove, setConfirmRemove] = React.useState(false);

  const dirty =
    canEdit &&
    (name !== agent.name ||
      model !== modelValue(agent.model) ||
      description !== (agent.description ?? "") ||
      system !== (agent.system ?? "") ||
      globalAgent !== initialGlobal ||
      JSON.stringify(projectIds) !== JSON.stringify(fallbackProjectIds) ||
      JSON.stringify(comparableSkillDrafts(skills)) !== JSON.stringify(comparableSkillDrafts(initialSkills)) ||
      JSON.stringify(comparableSubAgentDrafts(subAgents)) !== JSON.stringify(comparableSubAgentDrafts(initialSubAgents)) ||
      JSON.stringify(comparableMcpServerDrafts(mcpServers)) !== JSON.stringify(comparableMcpServerDrafts(initialMcpServers)));

  function requestClose() {
    if (dirty && !saving && !removing) {
      setConfirmClose(true);
      return;
    }
    onClose();
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!canEdit) return;

    setSaving(true);
    setError(null);
    try {
      const multiagent = serializeSubAgents(subAgents);
      const selectedMcpServers = serializeMcpServerDrafts(mcpServers, registeredMcpServers);
      const scopeChanged = globalAgent !== initialGlobal || JSON.stringify(projectIds) !== JSON.stringify(fallbackProjectIds);
      if (!globalAgent && projectIds.length === 0) {
        throw new Error("Select at least one project or make this agent global.");
      }
      await apiFetch<{ agent: Agent }>(`/agents/${encodeURIComponent(agent.id)}`, auth, {
        method: "PATCH",
        body: JSON.stringify({
          version: agent.version,
          name: name.trim(),
          model: model.trim(),
          description: nullableText(description),
          system: nullableText(system),
          ...(workspaceRole === "admin" && (scopeChanged || globalAgent) ? { global: globalAgent } : {}),
          ...(!globalAgent && scopeChanged ? { project_ids: projectIds } : {}),
          skills: serializeSkillDrafts(skills),
          multiagent,
          mcp_servers: selectedMcpServers,
          tools: serializeMcpToolsets(selectedMcpServers),
          metadata: { agent_parameter_config: null },
        }),
      });
      onChanged();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  function toggleProject(projectId: string, enabled: boolean) {
    setProjectIds((current) => (enabled ? uniqueStrings([...current, projectId]) : current.filter((id) => id !== projectId)));
  }

  async function remove() {
    if (!canEdit) return;

    setRemoving(true);
    setError(null);
    try {
      await apiFetch<{ agent: Agent }>(`/agents/${encodeURIComponent(agent.id)}/archive`, auth, { method: "POST", body: "{}" });
      onChanged();
    } catch (removeError) {
      setError(errorMessage(removeError));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Modal title="Agent details" onClose={requestClose} wide={!side} side={side}>
      <form className="form-grid" onSubmit={save}>
        <FormSection title="Agent">
          <label>
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} disabled={!canEdit} required />
          </label>
          <label>
            <span>Description</span>
            <input value={description} onChange={(event) => setDescription(event.target.value)} disabled={!canEdit} />
          </label>
          <label>
            <span>System prompt</span>
            <textarea value={system} onChange={(event) => setSystem(event.target.value)} disabled={!canEdit} rows={5} />
          </label>
        </FormSection>

        <CollapsibleSection title="Configuration" open={configurationOpen} onToggle={() => setConfigurationOpen((value) => !value)}>
          <label>
            <span>Model</span>
            <AgentModelSelect value={model} onChange={setModel} disabled={!canEdit} required />
          </label>
          <div className="advanced-fields">
            <SkillEditor skills={skills} onChange={setSkills} disabled={!canEdit} />
            <SubAgentEditor subAgents={subAgents} agents={subAgentOptions} onChange={setSubAgents} disabled={!canEdit} />
            <McpServerEditor servers={mcpServers} registeredServers={registeredMcpServers} onChange={setMcpServers} disabled={!canEdit} />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Details" open={detailsOpen} onToggle={() => setDetailsOpen((value) => !value)}>
          <div className="details-info-grid">
            <InfoRow icon={<Bot size={15} />} label="Agent ID" value={agent.id} />
            <InfoRow icon={<Bot size={15} />} label="Version" value={`v${agent.version}`} />
            <InfoRow icon={<Calendar size={15} />} label="Created" value={formatDateTime(agent.created_at)} />
            <InfoRow icon={<Calendar size={15} />} label="Updated" value={formatDateTime(agent.updated_at)} />
            <InfoRow icon={<User size={15} />} label="Creator" value={record.creator_uuid} />
            <InfoRow icon={canEdit ? <Pencil size={15} /> : <User size={15} />} label="Access" value={canEdit ? "Editable" : "Read only"} />
            <a className="doc-link" href="https://docs.anthropic.com/" target="_blank" rel="noreferrer">
              <ExternalLink size={15} aria-hidden="true" />
              Documentation
            </a>
          </div>
        </CollapsibleSection>

        {error ? <div className="notice error">{error}</div> : null}

        <div className="dialog-actions">
          {canEdit ? (
            <button className="danger-button" type="button" onClick={() => setConfirmRemove(true)} disabled={removing}>
              {removing ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Archive size={16} aria-hidden="true" />}
              Remove
            </button>
          ) : null}
          <button className="secondary-button" type="button" onClick={requestClose}>
            <X size={16} aria-hidden="true" />
            Close
          </button>
          {canEdit ? (
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
              Save
            </button>
          ) : null}
        </div>
      </form>
      {confirmClose ? (
        <ConfirmDialog title="Discard changes" message="Close this window and discard unsaved updates?" confirmLabel="Discard" onCancel={() => setConfirmClose(false)} onConfirm={onClose} />
      ) : null}
      {confirmRemove ? (
        <ConfirmDialog
          title="Remove agent"
          message={`Archive ${agent.name} and remove it from this registry?`}
          confirmLabel="Remove"
          danger
          onCancel={() => setConfirmRemove(false)}
          onConfirm={() => {
            setConfirmRemove(false);
            void remove();
          }}
        />
      ) : null}
    </Modal>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="form-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="form-section collapsible-section">
      <button className="collapsible-section-toggle" type="button" onClick={onToggle} aria-expanded={open}>
        <span>{title}</span>
        {open ? <ChevronDown size={17} aria-hidden="true" /> : <ChevronRight size={17} aria-hidden="true" />}
      </button>
      {open ? <div className="collapsible-section-body">{children}</div> : null}
    </section>
  );
}

function AgentModelSelect({
  value,
  onChange,
  disabled,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  const hasKnownValue = agentModelOptions.some((option) => option.value === value);

  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} required={required}>
      {!hasKnownValue && value ? <option value={value}>{value}</option> : null}
      {agentModelOptions.map((option) => (
        <option value={option.value} key={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function JsonEditor({ label, value, onChange, rows, disabled }: { label: string; value: string; onChange: (value: string) => void; rows: number; disabled?: boolean }) {
  return (
    <label>
      <span>{label}</span>
      <textarea className="code-input" value={value} onChange={(event) => onChange(event.target.value)} rows={rows} spellCheck={false} disabled={disabled} />
    </label>
  );
}

function AgentParameterEditor({ config, onChange, disabled }: { config: AgentParameterConfig; onChange: (config: AgentParameterConfig) => void; disabled?: boolean }) {
  function updateParameter(id: string, patch: Partial<AgentParameterDraft>) {
    onChange({ ...config, parameters: config.parameters.map((parameter) => (parameter.id === id ? { ...parameter, ...patch } : parameter)) });
  }

  function removeParameter(id: string) {
    onChange({ ...config, parameters: config.parameters.filter((parameter) => parameter.id !== id) });
  }

  return (
    <div className="structured-editor parameter-schema-editor">
      <div className="structured-editor-head">
        <span>Required values</span>
        <button className="secondary-button compact-button" type="button" onClick={() => onChange({ ...config, parameters: [...config.parameters, createAgentParameterDraft()] })} disabled={disabled || !config.enabled}>
          <Plus size={15} aria-hidden="true" />
          Add value
        </button>
      </div>
      <label className="check-row">
        <input type="checkbox" checked={config.enabled} onChange={(event) => onChange({ ...config, enabled: event.target.checked })} disabled={disabled} />
        <span>Enable custom values</span>
      </label>
      <label className="check-row">
        <input type="checkbox" checked={config.allowAdditional} onChange={(event) => onChange({ ...config, allowAdditional: event.target.checked })} disabled={disabled || !config.enabled} />
        <span>Allow additional custom values</span>
      </label>
      {!config.enabled ? <div className="structured-empty">Values are disabled</div> : null}
      {config.enabled && config.parameters.length === 0 ? <div className="structured-empty">No required values configured</div> : null}
      {config.enabled
        ? config.parameters.map((parameter) => (
            <div className="structured-row parameter-row" key={parameter.id}>
              <label>
                <span>Key</span>
                <input value={parameter.key} onChange={(event) => updateParameter(parameter.id, { key: event.target.value })} disabled={disabled} placeholder="theme" />
              </label>
              <label>
                <span>Label</span>
                <input value={parameter.label} onChange={(event) => updateParameter(parameter.id, { label: event.target.value })} disabled={disabled} placeholder="Theme" />
              </label>
              <label>
                <span>Type</span>
                <select value={parameter.type} onChange={(event) => updateParameter(parameter.id, { type: event.target.value as AgentParameterType })} disabled={disabled}>
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                  <option value="select">Select</option>
                </select>
              </label>
              <label>
                <span>Default</span>
                <input value={parameter.defaultValue} onChange={(event) => updateParameter(parameter.id, { defaultValue: event.target.value })} disabled={disabled} />
              </label>
              {parameter.type === "select" ? (
                <label>
                  <span>Options</span>
                  <input value={parameter.options} onChange={(event) => updateParameter(parameter.id, { options: event.target.value })} disabled={disabled} placeholder="light, dark" />
                </label>
              ) : null}
              <label className="parameter-description-field">
                <span>Description</span>
                <input value={parameter.description} onChange={(event) => updateParameter(parameter.id, { description: event.target.value })} disabled={disabled} />
              </label>
              <button className="icon-button row-remove-button" type="button" onClick={() => removeParameter(parameter.id)} disabled={disabled} title="Remove value">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          ))
        : null}
    </div>
  );
}

function NodeParameterEditor({ config, values, onChange, disabled }: { config: AgentParameterConfig; values: Record<string, string>; onChange: (values: Record<string, string>) => void; disabled?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const knownKeys = new Set(config.parameters.map((parameter) => parameter.key));
  const additionalEntries = Object.entries(values).filter(([key]) => !knownKeys.has(key));
  const hasExpandableValues = config.allowAdditional;

  function setValue(key: string, value: string) {
    onChange({ ...values, [key]: value });
  }

  function removeValue(key: string) {
    const next = { ...values };
    delete next[key];
    onChange(next);
  }

  function renameValue(previousKey: string, nextKey: string) {
    if (previousKey === nextKey || knownKeys.has(nextKey)) return;
    const next = { ...values };
    const value = next[previousKey] ?? "";
    delete next[previousKey];
    next[nextKey] = value;
    onChange(next);
  }

  function addAdditionalValue() {
    let index = 1;
    let key = "custom_value";
    while (values[key] !== undefined || knownKeys.has(key)) {
      index += 1;
      key = `custom_value_${index}`;
    }
    onChange({ ...values, [key]: "" });
  }

  return (
    <div className="node-parameter-editor">
      {config.parameters.length > 0 ? (
        <div className="node-required-parameter-fields">
          {config.parameters.map((parameter) => (
            <NodeParameterInput key={parameter.key} parameter={parameter} value={values[parameter.key] ?? parameter.defaultValue} onChange={(value) => setValue(parameter.key, value)} disabled={disabled} />
          ))}
        </div>
      ) : null}
      {hasExpandableValues ? (
        <button className="node-parameter-toggle" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          <span>Additional values</span>
          {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
        </button>
      ) : null}
      {open && hasExpandableValues ? (
        <div className="node-parameter-fields">
          {additionalEntries.map(([key, value]) => (
            <div className="node-parameter-additional-row" key={key}>
              <input value={key} onChange={(event) => renameValue(key, event.target.value)} disabled={disabled || !config.allowAdditional} />
              <input value={value} onChange={(event) => setValue(key, event.target.value)} disabled={disabled || !config.allowAdditional} />
              <button className="icon-button compact-icon" type="button" onClick={() => removeValue(key)} disabled={disabled || !config.allowAdditional} title="Remove value">
                <X size={12} aria-hidden="true" />
              </button>
            </div>
          ))}
          {config.allowAdditional ? (
            <button className="secondary-button compact-button" type="button" onClick={addAdditionalValue} disabled={disabled}>
              <Plus size={14} aria-hidden="true" />
              Add value
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function NodeParameterInput({ parameter, value, onChange, disabled }: { parameter: AgentParameterDraft; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const hint = `Enter ${parameter.label || parameter.key}...`;
  if (parameter.type === "boolean") {
    return (
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        <option value="">{hint}</option>
        <option value="true">True</option>
        <option value="false">False</option>
      </select>
    );
  }
  if (parameter.type === "select") {
    const options = selectOptionsFromString(parameter.options);
    return (
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        <option value="">{hint}</option>
        {options.map((option) => (
          <option value={option} key={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }
  return <input type={parameter.type === "number" ? "number" : "text"} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} placeholder={hint} />;
}

function SkillEditor({ skills, onChange, disabled }: { skills: SkillDraft[]; onChange: (skills: SkillDraft[]) => void; disabled?: boolean }) {
  function update(id: string, patch: Partial<SkillDraft>) {
    onChange(skills.map((skill) => (skill.id === id ? { ...skill, ...patch } : skill)));
  }

  function remove(id: string) {
    onChange(skills.filter((skill) => skill.id !== id));
  }

  return (
    <div className="structured-editor">
      <div className="structured-editor-head">
        <span>Skills</span>
        <button className="secondary-button compact-button" type="button" onClick={() => onChange([...skills, createSkillDraft()])} disabled={disabled}>
          <Plus size={15} aria-hidden="true" />
          Add skill
        </button>
      </div>

      {skills.length === 0 ? <div className="structured-empty">No skills configured</div> : null}

      {skills.map((skill) => (
        <div className="structured-row skill-row" key={skill.id}>
          <label>
            <span>Type</span>
            <select value={skill.type} onChange={(event) => update(skill.id, { type: event.target.value as SkillDraft["type"] })} disabled={disabled}>
              <option value="anthropic">Anthropic</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label>
            <span>Skill ID</span>
            <input value={skill.skillId} onChange={(event) => update(skill.id, { skillId: event.target.value })} disabled={disabled} placeholder={skill.type === "anthropic" ? "xlsx" : "skill_abc123"} />
          </label>
          <label>
            <span>Version</span>
            <input value={skill.version} onChange={(event) => update(skill.id, { version: event.target.value })} disabled={disabled} placeholder="latest" />
          </label>
          <button className="icon-button row-remove-button" type="button" onClick={() => remove(skill.id)} disabled={disabled} title="Remove skill">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}

function SubAgentEditor({
  subAgents,
  agents,
  onChange,
  disabled,
}: {
  subAgents: SubAgentDraft[];
  agents: AgentRecord[];
  onChange: (subAgents: SubAgentDraft[]) => void;
  disabled?: boolean;
}) {
  function update(id: string, patch: Partial<SubAgentDraft>) {
    onChange(subAgents.map((subAgent) => (subAgent.id === id ? { ...subAgent, ...patch } : subAgent)));
  }

  function remove(id: string) {
    onChange(subAgents.filter((subAgent) => subAgent.id !== id));
  }

  const selectedIds = new Set(subAgents.map((subAgent) => subAgent.agentId).filter(Boolean));

  return (
    <div className="structured-editor">
      <div className="structured-editor-head">
        <span>Sub agents</span>
        <button className="secondary-button compact-button" type="button" onClick={() => onChange([...subAgents, createSubAgentDraft()])} disabled={disabled || agents.length === 0}>
          <Plus size={15} aria-hidden="true" />
          Add sub agent
        </button>
      </div>

      {subAgents.length === 0 ? <div className="structured-empty">No sub agents configured</div> : null}

      {subAgents.map((subAgent) => (
        <div className="structured-row sub-agent-row" key={subAgent.id}>
          <label>
            <span>Agent</span>
            <select value={subAgent.agentId} onChange={(event) => update(subAgent.id, { agentId: event.target.value })} disabled={disabled}>
              <option value="">Select agent</option>
              {agents.map((record) => {
                const selectedElsewhere = selectedIds.has(record.id) && record.id !== subAgent.agentId;
                return (
                  <option value={record.id} key={record.id} disabled={selectedElsewhere}>
                    {record.agent.name} · {record.id}
                  </option>
                );
              })}
            </select>
          </label>
          <button className="icon-button row-remove-button" type="button" onClick={() => remove(subAgent.id)} disabled={disabled} title="Remove sub agent">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}

function McpServerEditor({
  servers,
  registeredServers,
  onChange,
  disabled,
}: {
  servers: McpServerDraft[];
  registeredServers: RegisteredMcpServer[];
  onChange: (servers: McpServerDraft[]) => void;
  disabled?: boolean;
}) {
  function update(id: string, registryId: string) {
    const registered = registeredServers.find((server) => server.id === registryId);
    if (!registered) return;
    onChange(servers.map((server) => (server.id === id ? mcpServerDraftFromRegistered(registered, server.id) : server)));
  }

  function remove(id: string) {
    onChange(servers.filter((server) => server.id !== id));
  }

  function add() {
    const firstAvailable = registeredServers.find((server) => !servers.some((selected) => selected.registryId === server.id));
    if (!firstAvailable) return;
    onChange([...servers, mcpServerDraftFromRegistered(firstAvailable)]);
  }

  const selectedRegistryIds = new Set(servers.map((server) => server.registryId).filter(Boolean));

  return (
    <div className="structured-editor">
      <div className="structured-editor-head">
        <span>MCP servers</span>
        <button className="secondary-button compact-button" type="button" onClick={add} disabled={disabled || registeredServers.length === 0 || selectedRegistryIds.size >= registeredServers.length}>
          <Plus size={15} aria-hidden="true" />
          Add MCP
        </button>
      </div>

      {registeredServers.length === 0 ? <div className="structured-empty">No MCP servers registered</div> : servers.length === 0 ? <div className="structured-empty">No MCP servers configured</div> : null}

      {servers.map((server) => (
        <div className="structured-row mcp-row" key={server.id}>
          <label>
            <span>MCP server</span>
            <select value={server.registryId} onChange={(event) => update(server.id, event.target.value)} disabled={disabled}>
              {!server.registryId ? <option value="">{server.name || "Select MCP server"}</option> : null}
              {registeredServers.map((registered) => {
                const selectedElsewhere = selectedRegistryIds.has(registered.id) && registered.id !== server.registryId;
                return (
                  <option value={registered.id} key={registered.id} disabled={selectedElsewhere}>
                    {registered.name}
                  </option>
                );
              })}
            </select>
          </label>
          <button className="icon-button row-remove-button" type="button" onClick={() => remove(server.id)} disabled={disabled} title="Remove MCP server">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
  wide,
  side,
  plainHeader,
  className: extraClassName,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  side?: boolean;
  plainHeader?: boolean;
  className?: string;
}) {
  const [entered, setEntered] = React.useState(false);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const className = `${side ? `modal side ${entered ? "entered" : ""}` : wide ? "modal wide" : "modal"}${extraClassName ? ` ${extraClassName}` : ""}`;
  const backdropClassName = side ? `modal-backdrop side-backdrop ${entered ? "entered" : ""}` : "modal-backdrop";
  return createPortal(
    <div className={backdropClassName} role="presentation" onMouseDown={onClose}>
      <section className={className} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header className={plainHeader ? "modal-header plain" : "modal-header"}>
          <h1>{title}</h1>
          {!plainHeader ? (
            <button className="icon-button" type="button" onClick={onClose} title="Close">
              <X size={18} aria-hidden="true" />
            </button>
          ) : (
            <button className="icon-button modal-close-button" type="button" onClick={onClose} title="Close">
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="confirm-backdrop" role="presentation" onMouseDown={onCancel}>
      <section className="confirm-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>
            <X size={16} aria-hidden="true" />
            Cancel
          </button>
          <button className={danger ? "danger-button" : "primary-button"} type="button" onClick={onConfirm}>
            <Check size={16} aria-hidden="true" />
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="info-row">
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

async function apiFetch<T>(path: string, auth: AuthSession, init: RequestInit = {}): Promise<T> {
  void auth;
  const method = (init.method ?? "GET").toUpperCase();
  const body = parseRequestBody(init.body);
  const anthropic = new AnthropicProxyApi();

  if (path === "/projects" && method === "GET") {
    return { projects: await listLocalProjects(anthropic) } as T;
  }
  if (path === "/projects" && method === "POST") {
    const project = await createLocalProject(anthropic, body);
    await localCanvasStore.saveProject(project);
    return { project } as T;
  }
  const projectMatch = /^\/projects\/([^/]+)$/.exec(path);
  if (projectMatch && method === "PATCH") {
    const project = await updateLocalProject(decodeURIComponent(projectMatch[1]), body);
    return { project } as T;
  }
  if (projectMatch && method === "DELETE") {
    await localCanvasStore.deleteProject(decodeURIComponent(projectMatch[1]));
    return { ok: true } as T;
  }
  if (/^\/projects\/[^/]+\/agents\/generate$/.test(path)) {
    throw new ApiError("Agent generation is not available in local mode. Create an agent directly from the canvas.", 410);
  }
  const projectReviewMatch = /^\/projects\/([^/]+)\/review$/.exec(path);
  if (projectReviewMatch && method === "POST") {
    const review = await reviewLocalProjectCanvas(anthropic, decodeURIComponent(projectReviewMatch[1]), body);
    return { review } as T;
  }
  const projectReviewApplyMatch = /^\/projects\/([^/]+)\/review\/apply$/.exec(path);
  if (projectReviewApplyMatch && method === "POST") {
    return await applyLocalCanvasReviewActions(anthropic, decodeURIComponent(projectReviewApplyMatch[1]), body) as T;
  }
  if (/^\/projects\/[^/]+\/run$/.test(path)) {
    throw new ApiError("Use Play cards to start Anthropic sessions from the local canvas.", 410);
  }
  const packageInstallMatch = /^\/projects\/([^/]+)\/package-presets\/([^/]+)\/install$/.exec(path);
  if (packageInstallMatch && method === "POST") {
    const result = await installLocalPackagePreset(anthropic, decodeURIComponent(packageInstallMatch[1]), decodeURIComponent(packageInstallMatch[2]), body);
    return result as T;
  }
  if (/^\/projects\/[^/]+\/integrations\/[^/]+\/install$/.test(path)) {
    throw new ApiError("Integration installation is replaced by local MCP server presets.", 410);
  }

  if (path === "/agents" && method === "GET") {
    return { agents: (await anthropic.listAgents()).map(normalizeAgentRecord) } as T;
  }
  if (path === "/agents" && method === "POST") {
    return { agent: normalizeAgent((await anthropic.createAgent(cleanAgentPayload(body))) as JsonObject) } as T;
  }
  const agentArchiveMatch = /^\/agents\/([^/]+)\/archive$/.exec(path);
  if (agentArchiveMatch && method === "POST") {
    return { agent: normalizeAgent((await anthropic.archiveAgent(decodeURIComponent(agentArchiveMatch[1]))) as JsonObject) } as T;
  }
  const agentMatch = /^\/agents\/([^/]+)$/.exec(path);
  if (agentMatch && method === "PATCH") {
    return { agent: normalizeAgent((await anthropic.updateAgent(decodeURIComponent(agentMatch[1]), cleanAgentPayload(body))) as JsonObject) } as T;
  }

  if (path === "/environments" && method === "GET") {
    return { environments: (await anthropic.listEnvironments()).map(normalizeEnvironment) } as T;
  }
  if (path === "/environments" && method === "POST") {
    return { environment: normalizeEnvironment((await anthropic.createEnvironment(body)) as JsonObject) } as T;
  }
  const environmentMatch = /^\/environments\/([^/]+)$/.exec(path);
  if (environmentMatch && method === "PATCH") {
    return { environment: normalizeEnvironment((await anthropic.updateEnvironment(decodeURIComponent(environmentMatch[1]), body)) as JsonObject) } as T;
  }
  if (environmentMatch && method === "DELETE") {
    return { environment: await anthropic.deleteEnvironment(decodeURIComponent(environmentMatch[1])) } as T;
  }

  if (path === "/deployments" && method === "GET") {
    return { deployments: (await anthropic.listDeployments()).map(normalizeDeployment) } as T;
  }
  if (path === "/deployments" && method === "POST") {
    return { deployment: normalizeDeployment((await anthropic.createDeployment(body)) as JsonObject) } as T;
  }
  const deploymentRunMatch = /^\/deployments\/([^/]+)\/run$/.exec(path);
  if (deploymentRunMatch && method === "POST") {
    return { run: await anthropic.runDeployment(decodeURIComponent(deploymentRunMatch[1])) } as T;
  }
  const deploymentMatch = /^\/deployments\/([^/]+)$/.exec(path);
  if (deploymentMatch && method === "DELETE") {
    return { deployment: normalizeDeployment((await anthropic.archiveDeployment(decodeURIComponent(deploymentMatch[1]))) as JsonObject) } as T;
  }
  if (deploymentMatch && method === "PATCH") {
    throw new ApiError("Editing scheduled deployments is not available in local proxy mode. Delete and recreate the schedule edge instead.", 410);
  }

  if (path === "/sessions" && method === "GET") {
    return { sessions: (await anthropic.listSessions()).map(normalizeManagedSession) } as T;
  }
  const sessionEventsMatch = /^\/sessions\/([^/]+)\/events$/.exec(path);
  if (sessionEventsMatch && method === "GET") {
    const messages = eventsToChatMessages(await anthropic.listSessionEvents(decodeURIComponent(sessionEventsMatch[1])));
    return { messages, awaitingApproval: null } as T;
  }
  const sessionInterruptMatch = /^\/sessions\/([^/]+)\/interrupt$/.exec(path);
  if (sessionInterruptMatch && method === "POST") {
    return { events: await anthropic.interruptSession(decodeURIComponent(sessionInterruptMatch[1])) } as T;
  }
  const sessionMatch = /^\/sessions\/([^/]+)$/.exec(path);
  if (sessionMatch && method === "DELETE") {
    return { session: await anthropic.deleteSession(decodeURIComponent(sessionMatch[1])) } as T;
  }

  if (path === "/chat" && method === "POST") {
    return await sendAnthropicChat(anthropic, body) as T;
  }
  if (path === "/chat/approval" && method === "POST") {
    return await sendAnthropicApproval(anthropic, body) as T;
  }

  if (path === "/mcp-servers" && method === "GET") {
    return { mcpServers: await listLocalMcpServers() } as T;
  }
  if (path === "/mcp-servers" && method === "POST") {
    const mcpServer = await saveLocalMcpServer(anthropic, body);
    return { mcpServer } as T;
  }
  const mcpServerMatch = /^\/mcp-servers\/([^/]+)$/.exec(path);
  if (mcpServerMatch && method === "PATCH") {
    const mcpServer = await saveLocalMcpServer(anthropic, { ...(body as JsonObject), id: decodeURIComponent(mcpServerMatch[1]) });
    return { mcpServer } as T;
  }

  if (path === "/skills" && method === "GET") {
    return { skills: (await anthropic.listSkills()).map(normalizeSkill) } as T;
  }
  if (path === "/skills" && method === "POST") {
    throw new ApiError("Custom skill upload is not wired for local proxy mode yet. Existing Anthropic skills are still listed.", 410);
  }
  if (/^\/skills\/[^/]+/.test(path)) {
    throw new ApiError("Skill editing is not wired for local proxy mode yet.", 410);
  }

  if (path === "/integrations" && method === "GET") {
    return { integrations: [] } as T;
  }
  if (path === "/tutorials" && method === "GET") {
    return { tutorials: normalizePresetTutorials() } as T;
  }
  if (path === "/package-presets" && method === "GET") {
    return { packagePresets: normalizePresetPackages() } as T;
  }
  if (/^\/(integrations|tutorials|package-presets)/.test(path)) {
    throw new ApiError("Preset editing is local JSON only. Edit src/data/presets.json to change this catalog.", 410);
  }

  if (path === "/vaults" && method === "GET") {
    return { vaults: (await anthropic.listVaults()).map(normalizeVault) } as T;
  }
  if (path === "/vaults" && method === "POST") {
    return { vault: normalizeVault((await anthropic.createVault(body)) as JsonObject) } as T;
  }
  const vaultCredentialListMatch = /^\/vaults\/([^/]+)\/credentials$/.exec(path);
  if (vaultCredentialListMatch && method === "GET") {
    return { credentials: (await anthropic.listVaultCredentials(decodeURIComponent(vaultCredentialListMatch[1]))).map(normalizeVaultCredential) } as T;
  }
  if (vaultCredentialListMatch && method === "POST") {
    return { credential: normalizeVaultCredential((await anthropic.createVaultCredential(decodeURIComponent(vaultCredentialListMatch[1]), body)) as JsonObject) } as T;
  }
  const vaultCredentialMatch = /^\/vaults\/([^/]+)\/credentials\/([^/]+)$/.exec(path);
  if (vaultCredentialMatch && method === "DELETE") {
    return { credential: await anthropic.deleteVaultCredential(decodeURIComponent(vaultCredentialMatch[1]), decodeURIComponent(vaultCredentialMatch[2])) } as T;
  }
  const vaultMatch = /^\/vaults\/([^/]+)$/.exec(path);
  if (vaultMatch && method === "DELETE") {
    return { vault: await anthropic.deleteVault(decodeURIComponent(vaultMatch[1])) } as T;
  }

  if (path === "/users" && method === "GET") {
    return { users: [{ uuid: auth.uuid, email: auth.email, role: auth.role ?? "admin" }] } as T;
  }
  if (/^\/users\/[^/]+$/.test(path)) {
    return { users: [{ uuid: auth.uuid, email: auth.email, role: "admin" }] } as T;
  }

  if (path === "/api-keys" && method === "GET") {
    return { apiKeys: [] } as T;
  }
  if (/^\/api-keys/.test(path)) {
    throw new ApiError("Server API keys are not available in local mode. API cards now provide local Anthropic cURL snippets.", 410);
  }

  throw new ApiError(`Local mode does not implement ${method} ${path}`, 404);
}

async function reviewLocalProjectCanvas(anthropic: AnthropicProxyApi, projectId: string, body: unknown): Promise<CanvasReviewResult> {
  const project = await localProjectById(projectId);
  const payload = isRecord(body) ? body : {};
  const graph = isProjectGraph(payload.graph) ? cloneProjectGraph(payload.graph) : cloneProjectGraph(project.graph);
  const userContext = stringValue(payload.prompt)?.trim() ?? "";
  const [agents, mcpServers] = await Promise.all([localAgentRecordsForReview(anthropic), listLocalMcpServers()]);
  const reviewContext = localCanvasReviewPromptContext(project, graph, agents, mcpServers, userContext);
  const validationContext = localCanvasReviewValidationContext(graph, agents, mcpServers);

  const message = await anthropic.createMessage({
    model: defaultAgentModel,
    max_tokens: 8000,
    system: localCanvasReviewSystemPrompt(),
    messages: [{ role: "user", content: JSON.stringify(reviewContext, null, 2) }],
    tools: [localCanvasReviewActionsTool()],
    tool_choice: { type: "tool", name: "propose_canvas_review_actions" },
  });

  const toolInput = messageToolUseInput(message, "propose_canvas_review_actions");
  if (toolInput === undefined) throw new ApiError("Claude did not return review actions.", 502);
  const review = normalizeLocalCanvasReviewResult(toolInput, validationContext);
  if (typeof review !== "string") return review;

  const repaired = await repairLocalCanvasReviewResult(anthropic, toolInput, review, reviewContext, validationContext);
  if (typeof repaired !== "string") return repaired;
  throw new ApiError(repaired, 502);
}

async function repairLocalCanvasReviewResult(
  anthropic: AnthropicProxyApi,
  malformedInput: unknown,
  validationError: string,
  reviewContext: JsonObject,
  validationContext: CanvasReviewValidationContext,
): Promise<CanvasReviewResult | string> {
  const message = await anthropic.createMessage({
    model: defaultAgentModel,
    max_tokens: 8000,
    system: `You repair malformed Raddus Canvas review tool calls.
Return only by calling propose_canvas_review_actions.

Convert the malformed tool input into valid propose_canvas_review_actions input.
The response must have summary as a string and actions as an array.
If the user asked to create an agent, return one create-agent action with agent_name, agent_description, system_prompt, mcp_server_ids, required_integration_ids, and add_to_canvas=true.
Use only MCP server IDs, agent IDs, and canvas node IDs that exist in the provided canvas context.
If no valid action can be recovered, return an empty actions array with a concise summary.`,
    messages: [{
      role: "user",
      content: JSON.stringify({
        validation_error: validationError,
        malformed_tool_input: malformedInput,
        canvas_context: reviewContext,
      }, null, 2),
    }],
    tools: [localCanvasReviewActionsTool()],
    tool_choice: { type: "tool", name: "propose_canvas_review_actions" },
  });

  const toolInput = messageToolUseInput(message, "propose_canvas_review_actions");
  if (toolInput === undefined) return validationError;
  const repairedReview = normalizeLocalCanvasReviewResult(toolInput, validationContext);
  return typeof repairedReview === "string" ? `${validationError}; repair failed: ${repairedReview}` : repairedReview;
}

async function applyLocalCanvasReviewActions(anthropic: AnthropicProxyApi, projectId: string, body: unknown): Promise<CanvasReviewApplyResult> {
  const payload = isRecord(body) ? body : {};
  if (!Array.isArray(payload.actions)) throw new ApiError("Review actions must be an array.", 400);
  const project = await localProjectById(projectId);
  const graph = isProjectGraph(payload.graph) ? cloneProjectGraph(payload.graph) : cloneProjectGraph(project.graph);
  const [agentRecords, mcpServers] = await Promise.all([localAgentRecordsForReview(anthropic), listLocalMcpServers()]);
  const review = normalizeLocalCanvasReviewResult(
    { summary: "", actions: payload.actions },
    localCanvasReviewValidationContext(graph, agentRecords, mcpServers),
  );
  if (typeof review === "string") throw new ApiError(review, 400);

  const agentsById = new Map(agentRecords.map((record) => [record.id, record]));
  const mcpById = new Map(mcpServers.map((server) => [server.id, server]));
  const nextGraph = cloneProjectGraph(graph);
  const applied: CanvasReviewAction[] = [];
  const skipped: CanvasReviewApplyResult["skipped"] = [];

  for (const action of review.actions) {
    const candidateGraph = cloneProjectGraph(nextGraph);
    try {
      const changed = await applyLocalCanvasReviewAction(anthropic, project.id, candidateGraph, agentsById, mcpById, action);
      if (changed) {
        nextGraph.nodes = candidateGraph.nodes;
        nextGraph.edges = candidateGraph.edges;
        applied.push(action);
      } else {
        skipped.push({ id: action.id, title: action.title, reason: "No change was needed." });
      }
    } catch (error) {
      skipped.push({ id: action.id, title: action.title, reason: errorMessage(error) });
    }
  }

  const projectRecord: ProjectRecord = {
    ...withoutProjectDescription(project),
    graph: syncProjectGraphAgentDependencies(nextGraph, sortAgents([...agentsById.values()]), mcpServers),
    current_user_role: "owner",
    updated_at: new Date().toISOString(),
  };
  await localCanvasStore.saveProject(projectRecord);
  return { project: projectRecord, applied, skipped };
}

async function applyLocalCanvasReviewAction(
  anthropic: AnthropicProxyApi,
  projectId: string,
  graph: ProjectGraph,
  agentsById: Map<string, AgentRecord>,
  mcpById: Map<string, RegisteredMcpServer>,
  action: CanvasReviewAction,
): Promise<boolean> {
  if (action.actionId === "create-agent") {
    const selectedMcpServerIds = localReviewActionMcpServerIds(action);
    const createdAgent = await createLocalAgentFromReviewAction(anthropic, projectId, action, mcpById, selectedMcpServerIds);
    agentsById.set(createdAgent.id, createdAgent);
    if (action.add_to_canvas !== false) {
      const agentNode = localEnsureAgentNode(graph, createdAgent.id, localReviewNextPosition(graph, "agent"));
      localEnsureReviewAgentDependencyNodes(graph, agentNode, selectedMcpServerIds, action.sub_agent_ids ?? []);
    }
    return true;
  }

  if (action.actionId === "update-agent") {
    const agentId = action.agent_id as string;
    const updatedAgent = await updateLocalAgentFromReviewAction(anthropic, agentId, action, agentsById, mcpById);
    agentsById.set(updatedAgent.id, updatedAgent);
    const agentNode = graph.nodes.find((node) => node.type === "agent" && node.agent_id === agentId);
    if (agentNode) localEnsureReviewAgentDependencyNodes(graph, agentNode, action.mcp_server_ids ?? [], action.sub_agent_ids ?? []);
    return true;
  }

  if (action.actionId === "add-agent-to-canvas") {
    return Boolean(localEnsureAgentNode(graph, action.agent_id as string, localReviewNextPosition(graph, "agent")));
  }

  if (action.actionId === "add-mcp-to-canvas") {
    const targetNode = action.target_agent_id ? localEnsureAgentNode(graph, action.target_agent_id, localReviewNextPosition(graph, "agent")) : undefined;
    const mcpNode = targetNode
      ? localEnsureMcpNodeForAgent(graph, action.mcp_server_id as string, targetNode, { x: targetNode.x + 52, y: targetNode.y + 112 })
      : localEnsureMcpNode(graph, action.mcp_server_id as string, localReviewNextPosition(graph, "mcp"));
    if (targetNode) {
      localEnsureEdge(graph, mcpNode.id, targetNode.id, "uses_mcp");
      await ensureLocalAgentUsesMcp(anthropic, action.target_agent_id as string, action.mcp_server_id as string, agentsById, mcpById);
    }
    return true;
  }

  if (action.actionId === "connect-mcp") {
    const agentNode = localEnsureAgentNode(graph, action.agent_id as string, localReviewNextPosition(graph, "agent"));
    const mcpNode = localEnsureMcpNodeForAgent(graph, action.mcp_server_id as string, agentNode, { x: agentNode.x + 52, y: agentNode.y + 112 });
    localEnsureEdge(graph, mcpNode.id, agentNode.id, "uses_mcp");
    await ensureLocalAgentUsesMcp(anthropic, action.agent_id as string, action.mcp_server_id as string, agentsById, mcpById);
    return true;
  }

  if (action.actionId === "connect-sub-agent") {
    const parentNode = localEnsureAgentNode(graph, action.parent_agent_id as string, localReviewNextPosition(graph, "agent"));
    const childNode = localEnsureAgentNode(graph, action.child_agent_id as string, { x: parentNode.x + 340, y: parentNode.y + 112 });
    localEnsureEdge(graph, parentNode.id, childNode.id, "sub_agent");
    await ensureLocalAgentHasSubAgent(anthropic, action.parent_agent_id as string, action.child_agent_id as string, agentsById, mcpById);
    return true;
  }

  if (action.actionId === "add-trigger") {
    const agentNode = localEnsureAgentNode(graph, action.target_agent_id as string, localReviewNextPosition(graph, "agent"));
    const triggerNode = createLocalReviewTriggerNode(action, { x: agentNode.x - 300, y: agentNode.y });
    graph.nodes.push(triggerNode);
    localEnsureEdge(graph, triggerNode.id, agentNode.id, localReviewTriggerEdgeType(triggerNode.type));
    return true;
  }

  if (action.actionId === "connect-trigger") {
    const triggerNode = graph.nodes.find((node) => node.id === action.source_node_id);
    if (!triggerNode || !localIsTriggerNodeType(triggerNode.type)) return false;
    const agentNode = localEnsureAgentNode(graph, action.target_agent_id as string, localReviewNextPosition(graph, "agent"));
    localEnsureEdge(graph, triggerNode.id, agentNode.id, localReviewTriggerEdgeType(triggerNode.type));
    return true;
  }

  if (action.actionId === "update-trigger") {
    const node = graph.nodes.find((item) => item.id === action.node_id);
    if (!node || !localIsTriggerNodeType(node.type)) return false;
    if ((node.type === "play" || node.type === "schedule") && action.trigger_prompt !== undefined) node.prompt = action.trigger_prompt;
    if (node.type === "schedule" && action.schedule !== undefined) node.schedule = action.schedule;
    if (node.type === "slack" && action.slack_trigger) node.slack_trigger = action.slack_trigger;
    if (node.type === "api" && action.api_key_id !== undefined) node.api_trigger = { api_key_id: action.api_key_id };
    if (node.type === "email" && action.receiver_id !== undefined) node.email_trigger = { receiver_id: action.receiver_id };
    return true;
  }

  return false;
}

async function createLocalAgentFromReviewAction(
  anthropic: AnthropicProxyApi,
  projectId: string,
  action: CanvasReviewAction,
  mcpById: Map<string, RegisteredMcpServer>,
  selectedMcpServerIds: string[],
): Promise<AgentRecord> {
  const selectedMcpServers = localReviewMcpServerParams(selectedMcpServerIds, mcpById);
  const subAgentIds = uniqueStrings(action.sub_agent_ids ?? []);
  const payload: JsonObject = {
    name: action.agent_name as string,
    model: action.model || defaultAgentModel,
    description: action.agent_description ?? null,
    system: action.system_prompt ?? null,
    metadata: { creator: localUserId, project_id: projectId, project_ids: projectId },
    ...(selectedMcpServers.length > 0 ? { mcp_servers: selectedMcpServers, tools: serializeMcpToolsets(selectedMcpServers) } : {}),
    ...(subAgentIds.length > 0 ? { multiagent: { type: "coordinator", agents: subAgentIds } } : {}),
  };
  return normalizeAgentRecord(await anthropic.createAgent(cleanAgentPayload(payload)));
}

async function updateLocalAgentFromReviewAction(
  anthropic: AnthropicProxyApi,
  agentId: string,
  action: CanvasReviewAction,
  agentsById: Map<string, AgentRecord>,
  mcpById: Map<string, RegisteredMcpServer>,
): Promise<AgentRecord> {
  const existing = agentsById.get(agentId);
  if (!existing) throw new Error("Agent not found.");
  const payload: JsonObject = { version: existing.agent.version };
  if (action.agent_name !== undefined) payload.name = action.agent_name;
  if (action.agent_description !== undefined) payload.description = action.agent_description || null;
  if (action.system_prompt !== undefined) payload.system = action.system_prompt || null;
  if (action.model !== undefined) payload.model = action.model || defaultAgentModel;
  if (action.mcp_server_ids !== undefined) {
    const selectedMcpServers = localReviewMcpServerParams(action.mcp_server_ids, mcpById);
    payload.mcp_servers = selectedMcpServers;
    payload.tools = serializeMcpToolsets(selectedMcpServers);
  }
  if (action.sub_agent_ids !== undefined) {
    const subAgentIds = uniqueStrings(action.sub_agent_ids);
    payload.multiagent = subAgentIds.length > 0 ? { type: "coordinator", agents: subAgentIds } : null;
  }
  return normalizeAgentRecord(await anthropic.updateAgent(agentId, cleanAgentPayload(payload)));
}

async function ensureLocalAgentUsesMcp(
  anthropic: AnthropicProxyApi,
  agentId: string,
  mcpServerId: string,
  agentsById: Map<string, AgentRecord>,
  mcpById: Map<string, RegisteredMcpServer>,
): Promise<void> {
  const record = agentsById.get(agentId);
  if (!record) throw new Error("Agent not found.");
  const existingIds = mcpServerIdsFromAgent(record.agent, [...mcpById.values()]);
  if (existingIds.includes(mcpServerId)) return;
  const updated = await updateLocalAgentFromReviewAction(anthropic, agentId, {
    id: `connect_mcp_${mcpServerId}`,
    actionId: "update-agent",
    title: "Connect MCP",
    rationale: "",
    details: "",
    agent_id: agentId,
    mcp_server_ids: uniqueStrings([...existingIds, mcpServerId]),
  }, agentsById, mcpById);
  agentsById.set(updated.id, updated);
}

async function ensureLocalAgentHasSubAgent(
  anthropic: AnthropicProxyApi,
  parentAgentId: string,
  childAgentId: string,
  agentsById: Map<string, AgentRecord>,
  mcpById: Map<string, RegisteredMcpServer>,
): Promise<void> {
  const record = agentsById.get(parentAgentId);
  if (!record) throw new Error("Parent agent not found.");
  const existingIds = subAgentIds(record.agent.multiagent);
  if (existingIds.includes(childAgentId)) return;
  const updated = await updateLocalAgentFromReviewAction(anthropic, parentAgentId, {
    id: `connect_sub_agent_${childAgentId}`,
    actionId: "update-agent",
    title: "Connect sub-agent",
    rationale: "",
    details: "",
    agent_id: parentAgentId,
    sub_agent_ids: uniqueStrings([...existingIds, childAgentId]),
  }, agentsById, mcpById);
  agentsById.set(updated.id, updated);
}

function localReviewActionMcpServerIds(action: CanvasReviewAction): string[] {
  const missingIntegrations = uniqueStrings(action.required_integration_ids ?? []);
  if (missingIntegrations.length > 0) {
    throw new Error(`Local integration templates are not available for this action: ${missingIntegrations.join(", ")}.`);
  }
  return uniqueStrings(action.mcp_server_ids ?? []);
}

function localReviewMcpServerParams(ids: string[], mcpById: Map<string, RegisteredMcpServer>): JsonObject[] {
  return uniqueStrings(ids).map((id) => {
    const server = mcpById.get(id);
    if (!server) throw new Error(`MCP server not found: ${id}.`);
    return { type: "url", name: server.name, url: server.url };
  });
}

function localEnsureReviewAgentDependencyNodes(graph: ProjectGraph, agentNode: ProjectNode, mcpServerIds: string[], subAgentIds: string[]): void {
  mcpServerIds.forEach((mcpServerId, index) => {
    const mcpNode = localEnsureMcpNodeForAgent(graph, mcpServerId, agentNode, { x: agentNode.x + 52, y: agentNode.y + 112 + index * 92 });
    localEnsureEdge(graph, mcpNode.id, agentNode.id, "uses_mcp");
  });
  subAgentIds.forEach((subAgentId, index) => {
    if (subAgentId === agentNode.agent_id) return;
    const subAgentNode = localEnsureAgentNode(graph, subAgentId, { x: agentNode.x + 340, y: agentNode.y + 112 + index * 132 });
    localEnsureEdge(graph, agentNode.id, subAgentNode.id, "sub_agent");
  });
}

function localEnsureAgentNode(graph: ProjectGraph, agentId: string, position: { x: number; y: number }): ProjectNode {
  const existing = graph.nodes.find((node) => node.type === "agent" && node.agent_id === agentId);
  if (existing) return existing;
  const node: ProjectNode = { id: `agent_${crypto.randomUUID()}`, type: "agent", agent_id: agentId, ...position };
  graph.nodes.push(node);
  return node;
}

function localEnsureMcpNode(graph: ProjectGraph, mcpServerId: string, position: { x: number; y: number }): ProjectNode {
  const existing = graph.nodes.find((node) =>
    node.type === "mcp" &&
    node.mcp_server_id === mcpServerId &&
    !graph.edges.some((edge) => edge.source === node.id && edge.type === "uses_mcp"),
  );
  if (existing) return existing;
  const node: ProjectNode = { id: `mcp_${crypto.randomUUID()}`, type: "mcp", mcp_server_id: mcpServerId, ...position };
  graph.nodes.push(node);
  return node;
}

function localEnsureMcpNodeForAgent(graph: ProjectGraph, mcpServerId: string, agentNode: ProjectNode, position: { x: number; y: number }): ProjectNode {
  const existingForAgent = graph.edges.flatMap((edge) => {
    if (edge.target !== agentNode.id || edge.type !== "uses_mcp") return [];
    const mcpNode = graph.nodes.find((node) => node.id === edge.source);
    return mcpNode?.type === "mcp" && mcpNode.mcp_server_id === mcpServerId ? [mcpNode] : [];
  })[0];
  if (existingForAgent) return existingForAgent;

  const available = graph.nodes.find((node) =>
    node.type === "mcp" &&
    node.mcp_server_id === mcpServerId &&
    !graph.edges.some((edge) => edge.source === node.id && edge.type === "uses_mcp"),
  );
  if (available) return available;

  const node: ProjectNode = {
    id: `mcp_${crypto.randomUUID()}`,
    type: "mcp",
    mcp_server_id: mcpServerId,
    synced_from_agent_id: agentNode.agent_id,
    synced_ref_id: mcpServerId,
    synced_role: "mcp",
    ...position,
  };
  graph.nodes.push(node);
  return node;
}

function localEnsureEdge(graph: ProjectGraph, source: string, target: string, type: ProjectEdgeType): ProjectEdge {
  const existing = graph.edges.find((edge) => edge.source === source && edge.target === target && edge.type === type);
  if (existing) return existing;
  const edge: ProjectEdge = { id: crypto.randomUUID(), source, target, type };
  graph.edges.push(edge);
  return edge;
}

function createLocalReviewTriggerNode(action: CanvasReviewAction, position: { x: number; y: number }): ProjectNode {
  const type = action.trigger_type ?? "play";
  const node: ProjectNode = { id: `trigger_${crypto.randomUUID()}`, type, ...position };
  if (type === "play") {
    node.prompt = action.trigger_prompt ?? "";
  } else if (type === "schedule") {
    node.prompt = action.trigger_prompt ?? "Run this deployment.";
    node.schedule = action.schedule ?? createDefaultScheduleDraft();
  } else if (type === "slack") {
    node.slack_trigger = action.slack_trigger ?? createDefaultSlackTriggerDraft();
  } else if (type === "api") {
    node.api_trigger = { api_key_id: action.api_key_id ?? "" };
  } else {
    node.email_trigger = { receiver_id: action.receiver_id ?? "" };
  }
  return node;
}

function localReviewTriggerEdgeType(type: ProjectNodeType): ProjectEdgeType {
  if (type === "schedule") return "schedules";
  if (type === "slack") return "slack_triggers";
  if (type === "api") return "api_triggers";
  if (type === "email") return "email_triggers";
  return "runs";
}

function localIsTriggerNodeType(type: ProjectNodeType): type is "play" | "schedule" | "slack" | "api" | "email" {
  return type === "play" || type === "schedule" || type === "slack" || type === "api" || type === "email";
}

function localReviewNextPosition(graph: ProjectGraph, type: ProjectNodeType): { x: number; y: number } {
  if (graph.nodes.length === 0) return { x: type === "agent" ? 420 : 120, y: 240 };
  const maxX = Math.max(...graph.nodes.map((node) => node.x));
  const minY = Math.min(...graph.nodes.map((node) => node.y));
  const count = graph.nodes.length;
  return type === "agent"
    ? { x: maxX + 320, y: minY + (count % 4) * 126 }
    : { x: Math.max(80, maxX - 320), y: minY + (count % 5) * 108 };
}

async function localProjectById(projectId: string): Promise<ProjectRecord> {
  const project = (await localCanvasStore.listProjects<ProjectRecord>()).find((candidate) => candidate.id === projectId);
  if (!project) throw new ApiError("Project not found.", 404);
  return withoutProjectDescription(project);
}

function withoutProjectDescription(project: ProjectRecord): ProjectRecord {
  const { description: _description, ...projectWithoutDescription } = project as ProjectRecord & { description?: unknown };
  const vaultIds = projectVaultIds(projectWithoutDescription, []);
  const shouldAttachVaultIds = hasExplicitProjectVaultIds(projectWithoutDescription) || Boolean(projectWithoutDescription.anthropic_vault_id);
  return {
    ...projectWithoutDescription,
    anthropic_vault_id: vaultIds[0] ?? projectWithoutDescription.anthropic_vault_id ?? null,
    ...(shouldAttachVaultIds ? { vault_ids: vaultIds } : {}),
  };
}

async function localAgentRecordsForReview(anthropic: AnthropicProxyApi): Promise<AgentRecord[]> {
  return sortAgents((await anthropic.listAgents()).map(normalizeAgentRecord).filter((record) => !record.archived_at));
}

function localCanvasReviewPromptContext(
  project: ProjectRecord,
  graph: ProjectGraph,
  agents: AgentRecord[],
  mcpServers: RegisteredMcpServer[],
  userContext: string,
): JsonObject {
  const agentById = new Map(agents.map((record) => [record.id, record.agent]));
  const mcpById = new Map(mcpServers.map((server) => [server.id, server]));
  return {
    project: {
      id: project.id,
      name: project.name,
      mode: "local_anthropic_proxy",
    },
    user_context: userContext || null,
    available_triggers: localCanvasReviewAvailableTriggers(),
    available_agents: agents.map((record) => ({
      id: record.id,
      name: record.agent.name,
      description: record.agent.description,
      system_prompt: record.agent.system,
      model: record.agent.model,
      mcp_servers: summarizeLocalAgentMcpServers(record.agent, mcpServers),
      sub_agents: subAgentIds(record.agent.multiagent).map((agentId) => ({
        id: agentId,
        name: agentById.get(agentId)?.name ?? null,
      })),
    })),
    available_mcp_servers: mcpServers.map((server) => ({
      id: server.id,
      name: server.name,
      description: server.description,
      url: server.url,
      auth_type: server.auth_type,
      source: server.project_ids.length === 0 ? "local_preset_or_global" : "local_project",
    })),
    available_packages: normalizePresetPackages().map((packagePreset) => ({
      id: packagePreset.id,
      name: packagePreset.name,
      description: packagePreset.description,
      package_name: packagePreset.package_name,
      target: packagePreset.target,
      environment_variables: packagePreset.environment_variables,
    })),
    available_tutorials: normalizePresetTutorials().map((tutorial) => ({
      id: tutorial.id,
      title: tutorial.title,
      description: tutorial.description,
    })),
    installed_integrations: [],
    available_integrations_not_installed: [],
    canvas: {
      nodes: graph.nodes.map((node) => {
        const agent = node.agent_id ? agentById.get(node.agent_id) : undefined;
        const mcpServer = node.mcp_server_id ? mcpById.get(node.mcp_server_id) : undefined;
        return {
          id: node.id,
          type: node.type,
          agent_id: node.agent_id,
          agent_name: agent?.name,
          mcp_server_id: node.mcp_server_id,
          mcp_server_name: mcpServer?.name,
          skill_id: node.skill_id,
          prompt: node.prompt,
          schedule: node.schedule,
          slack_trigger: node.slack_trigger,
          api_trigger: node.api_trigger ? { mode: "copy_curl_to_anthropic_session" } : undefined,
          email_trigger: node.email_trigger,
        };
      }),
      edges: graph.edges.map((edge) => ({ ...edge })),
    },
  };
}

function localCanvasReviewAvailableTriggers(): Array<Record<string, string>> {
  return [
    { type: "play", name: "Play", capability: "Manual run card for a user-initiated prompt." },
    { type: "schedule", name: "Schedule", capability: "Recurring cron-style Anthropic deployment trigger when an environment is available." },
    { type: "slack", name: "Slack", capability: "Local planning card for Slack-triggered workflows; external Slack hosting is not provided by this app." },
    { type: "api", name: "API", capability: "Local helper that copies a cURL command for creating or continuing Anthropic sessions; it is not a hosted webhook." },
    { type: "email", name: "Email", capability: "Local planning card for inbound email workflows; external email hosting is not provided by this app." },
  ];
}

function localCanvasReviewSystemPrompt(): string {
  return `You are reviewing a Raddus Canvas visual agent canvas.
Return only by calling propose_canvas_review_actions.

Assess the current canvas against the full local project inventory provided by the user message. Look for practical improvements such as:
- If the user asks for a new agent, return a create-agent action for that agent instead of general review actions.
- MCP servers connected to an agent should be explicitly named in that agent's system prompt with when and how to use them.
- Parent/coordinator agents with sub-agents should mention those sub-agents by name and describe when to delegate.
- Trigger cards should exist for useful entrypoints, be connected to agents, and have useful prompts/settings when applicable.
- API trigger cards in this app are local "copy cURL to Anthropic session" helpers, not hosted backend webhooks.
- Available agents, MCPs, and trigger types that materially improve the workflow may be added to the canvas.
- Existing canvas cards and edges should not be duplicated.

For create-agent actions, provide agent_name, agent_description, system_prompt, mcp_server_ids, required_integration_ids, and add_to_canvas=true unless the user explicitly asks not to add it.
Use only installed local MCP server IDs in mcp_server_ids when they materially help the agent.
Do not use required_integration_ids unless an available integration template is present in the provided context.
The actions field must always be an array, even when there is exactly one action.

Be conservative. Prefer a short list of high-signal actions over exhaustive churn. If the canvas is already healthy, return an empty actions array with a concise summary.
Every action must be independently runnable. Do not make one action depend on a new agent or node created by another action. For update-agent actions, provide complete replacement values for fields you change, especially system_prompt, mcp_server_ids, and sub_agent_ids. Use only existing project agent IDs, MCP server IDs, and canvas node IDs from the provided context unless actionId is create-agent.`;
}

function localCanvasReviewActionsTool(): JsonObject {
  const agentIdFields = {
    agent_id: { type: "string", description: "Existing agent id for update-agent, add-agent-to-canvas, or connect-mcp." },
    target_agent_id: { type: "string", description: "Existing agent id that a trigger or MCP should connect to." },
    parent_agent_id: { type: "string", description: "Existing parent/coordinator agent id for connect-sub-agent." },
    child_agent_id: { type: "string", description: "Existing child/sub-agent id for connect-sub-agent." },
  };
  return {
    name: "propose_canvas_review_actions",
    description: "Return canvas improvement actions for a local Anthropic canvas project.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "actions"],
      properties: {
        summary: { type: "string", maxLength: 1200 },
        actions: {
          type: "array",
          maxItems: 12,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "actionId", "title", "rationale", "details"],
            properties: {
              id: { type: "string", minLength: 1, maxLength: 64 },
              actionId: {
                type: "string",
                enum: ["create-agent", "update-agent", "add-agent-to-canvas", "add-mcp-to-canvas", "connect-mcp", "connect-sub-agent", "add-trigger", "connect-trigger", "update-trigger"],
              },
              title: { type: "string", minLength: 1, maxLength: 120 },
              rationale: { type: "string", maxLength: 1000 },
              details: { type: "string", maxLength: 2000 },
              agent_name: { type: "string", maxLength: 80 },
              agent_description: { type: "string", maxLength: 400 },
              system_prompt: { type: "string", maxLength: 12000 },
              model: { type: "string", maxLength: 80 },
              mcp_server_id: { type: "string" },
              mcp_server_ids: { type: "array", maxItems: 12, items: { type: "string" } },
              required_integration_ids: { type: "array", maxItems: 12, items: { type: "string" } },
              sub_agent_ids: { type: "array", maxItems: 12, items: { type: "string" } },
              ...agentIdFields,
              trigger_type: { type: "string", enum: ["play", "schedule", "slack", "api", "email"] },
              trigger_prompt: { type: "string", maxLength: 1000 },
              schedule: {
                type: "object",
                additionalProperties: false,
                properties: {
                  mode: { type: "string", enum: ["hours", "days", "weeks", "cron"] },
                  interval: { type: "number" },
                  minute: { type: "number" },
                  hour: { type: "number" },
                  dayOfWeek: { type: "number" },
                  expression: { type: "string" },
                  timezone: { type: "string" },
                },
              },
              slack_trigger: {
                type: "object",
                additionalProperties: false,
                required: ["type"],
                properties: {
                  type: { type: "string", enum: ["none", "all", "channel", "user", "keyword"] },
                  keyword: { type: "string" },
                  channel_id: { type: "string" },
                  user_id: { type: "string" },
                },
              },
              node_id: { type: "string", description: "Existing trigger node id for update-trigger." },
              source_node_id: { type: "string", description: "Existing trigger node id for connect-trigger." },
              api_key_id: { type: "string" },
              receiver_id: { type: "string" },
              add_to_canvas: { type: "boolean" },
            },
          },
        },
      },
    },
  };
}

function messageToolUseInput(message: unknown, toolName: string): unknown | undefined {
  if (!isRecord(message) || !Array.isArray(message.content)) return undefined;
  const toolUse = message.content.find((block) => isRecord(block) && block.type === "tool_use" && block.name === toolName);
  return isRecord(toolUse) ? toolUse.input : undefined;
}

function normalizeLocalCanvasReviewResult(value: unknown, context: CanvasReviewValidationContext): CanvasReviewResult | string {
  const resultValue = localParseJsonLikeValue(value);
  const rawActions = localCanvasReviewActionsFromUnknown(resultValue);
  if (!rawActions) {
    if (!isRecord(resultValue) && !Array.isArray(resultValue)) return "Canvas review result must be an object.";
    return `Canvas review actions must be an array or action object. Received ${localCanvasReviewShapeDescription(resultValue)}.`;
  }
  const summary = localCanvasReviewSummaryFromUnknown(resultValue);
  const actions: CanvasReviewAction[] = [];
  const ids = new Set<string>();

  for (const [index, rawAction] of rawActions.entries()) {
    if (!isRecord(rawAction)) return `Canvas review action ${index + 1} must be an object.`;
    const action = normalizeLocalCanvasReviewAction(rawAction, index, context);
    if (typeof action === "string") return action;
    const uniqueId = localUniqueReviewActionId(action.id, ids);
    actions.push({ ...action, id: uniqueId });
    ids.add(uniqueId);
  }

  return { summary, actions };
}

const localCanvasReviewActionPayloadKeys = [
  "actions",
  "action",
  "action_items",
  "actionItems",
  "items",
  "recommendations",
  "recommended_actions",
  "recommendedActions",
  "proposed_actions",
  "proposedActions",
  "proposed_action",
  "proposedAction",
  "canvas_actions",
  "canvasActions",
  "review_actions",
  "reviewActions",
  "changes",
  "change",
  "suggestions",
  "suggestion",
  "recommendation",
  "review",
  "result",
  "proposal",
  "payload",
  "data",
  "input",
  "output",
  "content",
  "response",
  "plan",
  "canvas_review",
  "canvasReview",
  "create_agent",
  "createAgent",
  "agent",
  "agent_spec",
  "agentSpec",
];

function localCanvasReviewActionsFromUnknown(value: unknown, depth = 0): unknown[] | undefined {
  const parsedValue = localParseJsonLikeValue(value);
  if (depth > 4) return undefined;
  if (Array.isArray(parsedValue)) return parsedValue;
  if (typeof parsedValue === "string" && localCanvasReviewActionsTextIsEmpty(parsedValue)) return [];
  if (!isRecord(parsedValue)) return undefined;
  if (localIsCanvasReviewActionObject(parsedValue)) return [parsedValue];

  const generatedAgentAction = localCanvasReviewActionFromGeneratedAgentSpec(parsedValue);
  if (generatedAgentAction) return [generatedAgentAction];

  for (const key of localCanvasReviewActionPayloadKeys) {
    if (parsedValue[key] === undefined) continue;
    const actions = localCanvasReviewActionsFromUnknown(parsedValue[key], depth + 1);
    if (actions) return actions;
  }

  const values = Object.values(parsedValue).filter((item) => item !== undefined && item !== null);
  const recordValues = values.filter((item): item is JsonObject => isRecord(item));
  if (recordValues.length > 0 && recordValues.length === values.length) {
    const actions = recordValues.map((item) => localIsCanvasReviewActionObject(item) ? item : localCanvasReviewActionFromGeneratedAgentSpec(item));
    if (actions.every((item): item is JsonObject => isRecord(item))) return actions;
  }

  return undefined;
}

function localCanvasReviewActionsTextIsEmpty(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "" ||
    normalized === "[]" ||
    normalized === "none" ||
    normalized === "no actions" ||
    normalized === "no action" ||
    normalized === "no changes" ||
    normalized === "no recommendations" ||
    normalized === "n/a";
}

function localCanvasReviewActionFromGeneratedAgentSpec(value: JsonObject): JsonObject | undefined {
  const name = localStringField(value, "agent_name") ?? localStringField(value, "agentName") ?? localStringField(value, "name");
  const systemPrompt = localStringField(value, "system_prompt") ?? localStringField(value, "systemPrompt");
  if (!name || !systemPrompt) return undefined;
  const description = localStringField(value, "agent_description") ?? localStringField(value, "agentDescription") ?? localStringField(value, "description") ?? "";
  return {
    id: localNormalizedPlanId(localStringField(value, "id")) || "create_agent",
    actionId: "create-agent",
    title: localStringField(value, "title") ?? `Create ${name}`,
    rationale: localStringField(value, "rationale") ?? (description || "The user asked to create this agent."),
    details: localStringField(value, "details") ?? (description || "Creates the agent and adds it to the canvas."),
    agent_name: name,
    agent_description: description,
    system_prompt: systemPrompt,
    model: localStringField(value, "model"),
    mcp_server_id: localStringField(value, "mcp_server_id") ?? localStringField(value, "mcpServerId"),
    mcp_server_ids: value.mcp_server_ids ?? value.mcpServerIds,
    required_integration_ids: value.required_integration_ids ?? value.requiredIntegrationIds,
    add_to_canvas: typeof value.add_to_canvas === "boolean" ? value.add_to_canvas : true,
  };
}

function localCanvasReviewSummaryFromUnknown(value: unknown, depth = 0): string {
  const parsedValue = localParseJsonLikeValue(value);
  if (depth > 4 || !isRecord(parsedValue)) return "";
  const summary = localStringField(parsedValue, "summary")?.trim();
  if (summary) return summary;
  for (const key of ["review", "result", "proposal", "response", "plan", "canvas_review", "canvasReview"]) {
    const nested = localCanvasReviewSummaryFromUnknown(parsedValue[key], depth + 1);
    if (nested) return nested;
  }
  return "";
}

function localIsCanvasReviewActionObject(value: JsonObject): boolean {
  return normalizeLocalCanvasReviewActionId(
    localStringField(value, "actionId") ??
    localStringField(value, "action_id") ??
    localStringField(value, "type"),
  ) !== undefined;
}

function localParseJsonLikeValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  const jsonText = localJsonTextFromString(trimmed);
  if (!jsonText) return value;
  try {
    return JSON.parse(jsonText) as unknown;
  } catch {
    return value;
  }
}

function localJsonTextFromString(value: string): string | null {
  if (!value) return null;
  if (value[0] === "{" || value[0] === "[") return value;
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(value);
  if (fenceMatch) return localJsonTextFromString(fenceMatch[1].trim());
  const arrayStart = value.indexOf("[");
  const objectStart = value.indexOf("{");
  const starts = [arrayStart, objectStart].filter((index) => index >= 0);
  if (starts.length === 0) return null;
  const start = Math.min(...starts);
  const opener = value[start];
  const closer = opener === "[" ? "]" : "}";
  const end = value.lastIndexOf(closer);
  return end > start ? value.slice(start, end + 1).trim() : null;
}

function localCanvasReviewShapeDescription(value: unknown): string {
  if (Array.isArray(value)) return `array(${value.length})`;
  if (!isRecord(value)) return typeof value;
  const entries = Object.entries(value).slice(0, 10).map(([key, item]) => `${key}:${localCanvasReviewValueKind(item)}`);
  const suffix = Object.keys(value).length > entries.length ? ", ..." : "";
  return `{${entries.join(", ")}${suffix}}`;
}

function localCanvasReviewValueKind(value: unknown): string {
  if (Array.isArray(value)) return `array(${value.length})`;
  if (isRecord(value)) return `object(${Object.keys(value).slice(0, 5).join("|")})`;
  if (value === null) return "null";
  return typeof value;
}

function normalizeLocalCanvasReviewAction(rawAction: JsonObject, index: number, context: CanvasReviewValidationContext): CanvasReviewAction | string {
  const actionId = normalizeLocalCanvasReviewActionId(
    localStringField(rawAction, "actionId") ??
    localStringField(rawAction, "action_id") ??
    localStringField(rawAction, "type"),
  );
  if (!actionId) return `Canvas review action ${index + 1} has an unsupported actionId.`;
  const id = localNormalizedPlanId(localStringField(rawAction, "id")) || `action_${index + 1}`;
  const title = localStringField(rawAction, "title")?.trim();
  if (!title) return `Canvas review action ${index + 1} needs a title.`;

  const action: CanvasReviewAction = {
    id,
    actionId,
    title: localClippedString(title, 120),
    rationale: localClippedString(localStringField(rawAction, "rationale") ?? "", 1000),
    details: localClippedString(localStringField(rawAction, "details") ?? "", 2000),
  };

  const agentId = localStringField(rawAction, "agent_id") ?? localStringField(rawAction, "agentId");
  const targetAgentId = localStringField(rawAction, "target_agent_id") ?? localStringField(rawAction, "targetAgentId");
  const parentAgentId = localStringField(rawAction, "parent_agent_id") ?? localStringField(rawAction, "parentAgentId");
  const childAgentId = localStringField(rawAction, "child_agent_id") ?? localStringField(rawAction, "childAgentId");
  const mcpServerId = localStringField(rawAction, "mcp_server_id") ?? localStringField(rawAction, "mcpServerId");
  const nodeId = localStringField(rawAction, "node_id") ?? localStringField(rawAction, "nodeId");
  const sourceNodeId = localStringField(rawAction, "source_node_id") ?? localStringField(rawAction, "sourceNodeId");

  if (agentId) action.agent_id = agentId;
  if (targetAgentId) action.target_agent_id = targetAgentId;
  if (parentAgentId) action.parent_agent_id = parentAgentId;
  if (childAgentId) action.child_agent_id = childAgentId;
  if (mcpServerId) action.mcp_server_id = mcpServerId;
  if (nodeId) action.node_id = nodeId;
  if (sourceNodeId) action.source_node_id = sourceNodeId;
  action.agent_name = localClippedOptionalString(localStringField(rawAction, "agent_name") ?? localStringField(rawAction, "agentName"), 80);
  action.agent_description = localClippedOptionalString(localStringField(rawAction, "agent_description") ?? localStringField(rawAction, "agentDescription"), 400);
  action.system_prompt = localClippedOptionalString(localStringField(rawAction, "system_prompt") ?? localStringField(rawAction, "systemPrompt"), 12000);
  action.model = localClippedOptionalString(localStringField(rawAction, "model"), 80);
  action.trigger_prompt = localClippedOptionalString(localStringField(rawAction, "trigger_prompt") ?? localStringField(rawAction, "triggerPrompt") ?? localStringField(rawAction, "prompt"), 1000);
  action.api_key_id = localClippedOptionalString(localStringField(rawAction, "api_key_id") ?? localStringField(rawAction, "apiKeyId"), 128);
  action.receiver_id = localClippedOptionalString(localStringField(rawAction, "receiver_id") ?? localStringField(rawAction, "receiverId"), 128);
  if (typeof rawAction.add_to_canvas === "boolean") action.add_to_canvas = rawAction.add_to_canvas;

  const mcpServerIds = localStringArrayFromUnknown(rawAction.mcp_server_ids ?? rawAction.mcpServerIds);
  if (mcpServerIds) action.mcp_server_ids = uniqueStrings(mcpServerIds);
  const requiredIntegrationIds = localStringArrayFromUnknown(rawAction.required_integration_ids ?? rawAction.requiredIntegrationIds);
  if (requiredIntegrationIds) action.required_integration_ids = uniqueStrings(requiredIntegrationIds);
  const subAgentIdsValue = localStringArrayFromUnknown(rawAction.sub_agent_ids ?? rawAction.subAgentIds);
  if (subAgentIdsValue) action.sub_agent_ids = uniqueStrings(subAgentIdsValue);
  const triggerType = localStringField(rawAction, "trigger_type") ?? localStringField(rawAction, "triggerType");
  if (triggerType) {
    if (!localIsGeneratedTriggerType(triggerType)) return `Canvas review action ${index + 1} has an unsupported trigger type.`;
    action.trigger_type = triggerType;
  }
  if (rawAction.schedule !== undefined) action.schedule = normalizeLocalReviewSchedule(rawAction.schedule);
  const slackTrigger = isRecord(rawAction.slack_trigger) ? rawAction.slack_trigger : isRecord(rawAction.slackTrigger) ? rawAction.slackTrigger : undefined;
  if (slackTrigger) action.slack_trigger = normalizeLocalReviewSlackTrigger(slackTrigger);

  const validationError = validateLocalCanvasReviewAction(action, context, index);
  return validationError ?? action;
}

function validateLocalCanvasReviewAction(action: CanvasReviewAction, context: CanvasReviewValidationContext, index: number): string | null {
  const label = `Canvas review action ${index + 1}`;
  const hasAgentUpdate =
    action.agent_name !== undefined ||
    action.agent_description !== undefined ||
    action.system_prompt !== undefined ||
    action.mcp_server_ids !== undefined ||
    action.sub_agent_ids !== undefined ||
    action.model !== undefined;

  if (action.agent_id && !context.agentIds.has(action.agent_id)) return `${label} references an unknown agent.`;
  if (action.target_agent_id && !context.agentIds.has(action.target_agent_id)) return `${label} references an unknown target agent.`;
  if (action.parent_agent_id && !context.agentIds.has(action.parent_agent_id)) return `${label} references an unknown parent agent.`;
  if (action.child_agent_id && !context.agentIds.has(action.child_agent_id)) return `${label} references an unknown child agent.`;
  if (action.mcp_server_id && !context.mcpServerIds.has(action.mcp_server_id)) return `${label} references an unknown MCP server.`;
  if (action.mcp_server_ids?.some((id) => !context.mcpServerIds.has(id))) return `${label} references an unknown MCP server.`;
  if (action.required_integration_ids?.some((id) => !context.integrationTemplateIds.has(id))) return `${label} references an unknown integration.`;
  if (action.sub_agent_ids?.some((id) => !context.agentIds.has(id))) return `${label} references an unknown sub-agent.`;
  if (action.node_id && !context.nodeIds.has(action.node_id)) return `${label} references an unknown node.`;
  if (action.source_node_id && !context.nodeIds.has(action.source_node_id)) return `${label} references an unknown source node.`;

  if (action.actionId === "create-agent" && (!action.agent_name || !action.system_prompt)) return `${label} needs agent_name and system_prompt.`;
  if (action.actionId === "update-agent" && (!action.agent_id || !hasAgentUpdate)) return `${label} needs agent_id and at least one agent field to update.`;
  if (action.actionId === "add-agent-to-canvas" && !action.agent_id) return `${label} needs agent_id.`;
  if (action.actionId === "add-mcp-to-canvas" && !action.mcp_server_id) return `${label} needs mcp_server_id.`;
  if (action.actionId === "connect-mcp" && (!action.agent_id || !action.mcp_server_id)) return `${label} needs agent_id and mcp_server_id.`;
  if (action.actionId === "connect-sub-agent" && (!action.parent_agent_id || !action.child_agent_id)) return `${label} needs parent_agent_id and child_agent_id.`;
  if (action.actionId === "connect-sub-agent" && action.parent_agent_id === action.child_agent_id) return `${label} cannot connect an agent to itself.`;
  if (action.actionId === "add-trigger" && (!action.trigger_type || !action.target_agent_id)) return `${label} needs trigger_type and target_agent_id.`;
  if (action.actionId === "connect-trigger" && (!action.source_node_id || !action.target_agent_id)) return `${label} needs source_node_id and target_agent_id.`;
  if (action.actionId === "connect-trigger" && action.source_node_id && !context.triggerNodeIds.has(action.source_node_id)) return `${label} source node must be a trigger.`;
  if (action.actionId === "update-trigger" && !action.node_id) return `${label} needs node_id.`;
  if (action.actionId === "update-trigger" && action.node_id && !context.triggerNodeIds.has(action.node_id)) return `${label} node must be a trigger.`;

  return null;
}

function localCanvasReviewValidationContext(graph: ProjectGraph, agents: AgentRecord[], mcpServers: RegisteredMcpServer[]): CanvasReviewValidationContext {
  return {
    agentIds: new Set(agents.map((agent) => agent.id)),
    mcpServerIds: new Set(mcpServers.map((server) => server.id)),
    integrationTemplateIds: new Set(),
    nodeIds: new Set(graph.nodes.map((node) => node.id)),
    triggerNodeIds: new Set(graph.nodes.filter((node) => localIsTriggerNodeType(node.type)).map((node) => node.id)),
  };
}

function summarizeLocalAgentMcpServers(agent: Agent, mcpServers: RegisteredMcpServer[]): Array<Record<string, string | null>> {
  const servers = Array.isArray(agent.mcp_servers) ? agent.mcp_servers.filter(isRecord) : [];
  return servers.map((server) => {
    const name = typeof server.name === "string" ? server.name : "";
    const url = typeof server.url === "string" ? server.url : "";
    const registered = mcpServers.find((candidate) => candidate.name === name || candidate.url === url);
    return {
      id: registered?.id ?? null,
      name,
      url,
    };
  });
}

function normalizeLocalCanvasReviewActionId(value: string | undefined): CanvasReviewActionId | undefined {
  const normalized = value
    ?.trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
  return localIsCanvasReviewActionId(normalized) ? normalized : undefined;
}

function localIsCanvasReviewActionId(value: string | undefined): value is CanvasReviewActionId {
  return value === "create-agent" ||
    value === "update-agent" ||
    value === "add-agent-to-canvas" ||
    value === "add-mcp-to-canvas" ||
    value === "connect-mcp" ||
    value === "connect-sub-agent" ||
    value === "add-trigger" ||
    value === "connect-trigger" ||
    value === "update-trigger";
}

function localIsGeneratedTriggerType(value: string): value is NonNullable<CanvasReviewAction["trigger_type"]> {
  return value === "play" || value === "schedule" || value === "slack" || value === "api" || value === "email";
}

function localStringArrayFromUnknown(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

function normalizeLocalReviewSchedule(value: unknown): ScheduleDraft {
  const fallback = createDefaultScheduleDraft();
  if (!isRecord(value)) return fallback;
  const mode = value.mode === "hours" || value.mode === "days" || value.mode === "weeks" || value.mode === "cron" ? value.mode : "cron";
  return {
    mode,
    interval: localFiniteNumberField(value, "interval") ?? fallback.interval,
    minute: localFiniteNumberField(value, "minute") ?? fallback.minute,
    hour: localFiniteNumberField(value, "hour") ?? fallback.hour,
    dayOfWeek: localFiniteNumberField(value, "dayOfWeek") ?? localFiniteNumberField(value, "day_of_week") ?? fallback.dayOfWeek,
    expression: localStringField(value, "expression")?.trim() || fallback.expression,
    timezone: localStringField(value, "timezone")?.trim() || fallback.timezone,
  };
}

function normalizeLocalReviewSlackTrigger(value: JsonObject | undefined): SlackTriggerDraft {
  const type = value ? localStringField(value, "type") : undefined;
  if (type === "all" || type === "none") return { type };
  if (!value) return createDefaultSlackTriggerDraft();
  if (type === "channel") return { type, channel_id: localStringField(value, "channel_id")?.trim() ?? "" };
  if (type === "user") return { type, user_id: localStringField(value, "user_id")?.trim() ?? "" };
  if (type === "keyword") return { type, keyword: localStringField(value, "keyword")?.trim() ?? "" };
  return createDefaultSlackTriggerDraft();
}

function localFiniteNumberField(body: JsonObject, key: string): number | undefined {
  const value = Number(body[key]);
  return Number.isFinite(value) ? value : undefined;
}

function localStringField(body: JsonObject, key: string): string | undefined {
  return typeof body[key] === "string" ? body[key] : undefined;
}

function localClippedOptionalString(value: string | undefined, maxLength: number): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed ? localClippedString(trimmed, maxLength) : undefined;
}

function localClippedString(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

function localUniqueReviewActionId(id: string, ids: Set<string>): string {
  if (!ids.has(id)) return id;
  let counter = 2;
  while (ids.has(`${id}_${counter}`)) counter += 1;
  return `${id}_${counter}`;
}

function localNormalizedPlanId(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
}

function parseRequestBody(body: BodyInit | null | undefined): unknown {
  if (!body) return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body) as unknown;
    } catch {
      return {};
    }
  }
  return body;
}

async function listLocalProjects(anthropic: AnthropicProxyApi): Promise<ProjectRecord[]> {
  const projects = (await localCanvasStore.listProjects<ProjectRecord>()).map(withoutProjectDescription);
  const defaultVaultId = await firstAvailableAnthropicVaultId(anthropic);
  const defaultEnvironmentId = await firstAvailableAnthropicEnvironmentId(anthropic);
  if (!defaultVaultId && !defaultEnvironmentId) return projects;
  let changed = false;
  const nextProjects = projects.map((project) => {
    let nextProject = project;
    if (defaultEnvironmentId && !project.anthropic_environment_id) {
      changed = true;
      nextProject = { ...nextProject, anthropic_environment_id: defaultEnvironmentId };
    }
    if (defaultVaultId && !hasExplicitProjectVaultIds(project) && !project.anthropic_vault_id) {
      changed = true;
      nextProject = { ...nextProject, anthropic_vault_id: defaultVaultId, vault_ids: [defaultVaultId] };
    }
    return nextProject;
  });
  if (changed) {
    await Promise.all(nextProjects.filter((project) => {
      const current = projects.find((candidate) => candidate.id === project.id);
      return current && JSON.stringify(projectEditableShape(current)) !== JSON.stringify(projectEditableShape(project));
    }).map((project) => localCanvasStore.saveProject(project)));
  }
  return nextProjects;
}

async function createLocalProject(anthropic: AnthropicProxyApi, body: unknown): Promise<ProjectRecord> {
  const value = isRecord(body) ? body : {};
  const now = new Date().toISOString();
  const requestedVaultIds = uniqueStrings(stringArray(value.vault_ids).map((vaultId) => vaultId.trim()).filter(Boolean));
  const fallbackVaultId = nullableStringValue(value.anthropic_vault_id) ?? nullableStringValue(value.vault_id) ?? await firstAvailableAnthropicVaultId(anthropic);
  const vaultIds = requestedVaultIds.length > 0 ? requestedVaultIds : fallbackVaultId ? [fallbackVaultId] : [];
  const environmentId = nullableStringValue(value.anthropic_environment_id) ?? nullableStringValue(value.environment_id) ?? await firstAvailableAnthropicEnvironmentId(anthropic);
  return {
    id: crypto.randomUUID(),
    name: typeof value.name === "string" && value.name.trim() ? value.name.trim() : "Untitled project",
    creator_uuid: localUserId,
    graph: isProjectGraph(value.graph) ? value.graph : createDefaultProjectGraph(),
    is_public: false,
    anthropic_environment_id: environmentId,
    anthropic_vault_id: vaultIds[0] ?? null,
    vault_ids: vaultIds,
    current_user_role: "owner",
    created_at: now,
    updated_at: now,
  };
}

async function updateLocalProject(projectId: string, body: unknown): Promise<ProjectRecord> {
  const projects = await localCanvasStore.listProjects<ProjectRecord>();
  const existing = projects.find((project) => project.id === projectId);
  if (!existing) throw new ApiError("Project not found.", 404);
  const value = isRecord(body) ? body : {};
  const projectWithoutDescription = withoutProjectDescription(existing);
  const hasVaultIds = Object.prototype.hasOwnProperty.call(value, "vault_ids");
  const nextVaultIds = hasVaultIds
    ? uniqueStrings(stringArray(value.vault_ids).map((vaultId) => vaultId.trim()).filter(Boolean))
    : Object.prototype.hasOwnProperty.call(value, "anthropic_vault_id")
      ? nullableStringValue(value.anthropic_vault_id)
        ? [nullableStringValue(value.anthropic_vault_id) as string]
        : []
      : projectVaultIds(projectWithoutDescription, []);
  const nextEnvironmentId = Object.prototype.hasOwnProperty.call(value, "anthropic_environment_id")
    ? nullableStringValue(value.anthropic_environment_id)
    : Object.prototype.hasOwnProperty.call(value, "environment_id")
      ? nullableStringValue(value.environment_id)
      : projectWithoutDescription.anthropic_environment_id ?? null;
  const next: ProjectRecord = {
    ...projectWithoutDescription,
    name: typeof value.name === "string" && value.name.trim() ? value.name.trim() : existing.name,
    graph: isProjectGraph(value.graph) ? value.graph : existing.graph,
    anthropic_environment_id: nextEnvironmentId,
    anthropic_vault_id: nextVaultIds[0] ?? null,
    vault_ids: nextVaultIds,
    current_user_role: "owner",
    updated_at: new Date().toISOString(),
  };
  await localCanvasStore.saveProject(next);
  return next;
}

function isProjectGraph(value: unknown): value is ProjectGraph {
  return isRecord(value) && Array.isArray(value.nodes) && Array.isArray(value.edges);
}

function cleanAgentPayload(body: unknown): JsonObject {
  if (!isRecord(body)) return {};
  const ignored = new Set(["global", "project_ids"]);
  const entries = Object.entries(body).flatMap(([key, value]) => {
    if (ignored.has(key) || value === undefined) return [];
    if (key === "metadata" && isRecord(value)) {
      const metadata = Object.fromEntries(
        Object.entries(value).flatMap(([metadataKey, metadataValue]) =>
          typeof metadataValue === "string" ? [[metadataKey, metadataValue]] : metadataValue == null ? [] : [[metadataKey, JSON.stringify(metadataValue)]],
        ),
      );
      return Object.keys(metadata).length > 0 ? [[key, metadata]] : [];
    }
    if (value === null && (key === "tools" || key === "skills" || key === "mcp_servers" || key === "multiagent")) return [[key, null]];
    return [[key, value]];
  });
  return Object.fromEntries(entries) as JsonObject;
}

function normalizeAgentRecord(value: unknown): AgentRecord {
  const agent = normalizeAgent(value);
  return {
    id: agent.id,
    creator_uuid: localUserId,
    name: agent.name,
    version: agent.version,
    archived_at: agent.archived_at,
    created_at: agent.created_at,
    updated_at: agent.updated_at,
    agent,
  };
}

function normalizeAgent(value: unknown): Agent {
  const record = isRecord(value) ? value : {};
  const now = new Date().toISOString();
  const id = stringValue(record.id) ?? crypto.randomUUID();
  const version = numberValue(record.version) ?? 1;
  return {
    id,
    name: stringValue(record.name) ?? id,
    version,
    description: nullableStringValue(record.description),
    system: nullableStringValue(record.system),
    model: record.model ?? defaultAgentModel,
    metadata: stringRecord(record.metadata),
    tools: arrayValue(record.tools),
    skills: arrayValue(record.skills),
    mcp_servers: arrayValue(record.mcp_servers),
    multiagent: record.multiagent ?? null,
    archived_at: nullableStringValue(record.archived_at),
    created_at: stringValue(record.created_at) ?? now,
    updated_at: stringValue(record.updated_at) ?? now,
  };
}

function normalizeEnvironment(value: unknown): AnthropicEnvironment {
  const record = isRecord(value) ? value : {};
  const now = new Date().toISOString();
  const id = stringValue(record.id) ?? crypto.randomUUID();
  return {
    id,
    name: stringValue(record.name) ?? id,
    description: nullableStringValue(record.description),
    archived_at: nullableStringValue(record.archived_at),
    created_at: stringValue(record.created_at) ?? now,
    updated_at: stringValue(record.updated_at) ?? now,
    config: environmentConfig(record.config),
    metadata: stringRecord(record.metadata),
    scope: record.scope === "organization" ? "organization" : "account",
  };
}

function normalizeDeployment(value: unknown): AnthropicDeployment {
  const record = isRecord(value) ? value : {};
  const now = new Date().toISOString();
  const id = stringValue(record.id) ?? crypto.randomUUID();
  const rawAgent = isRecord(record.agent) ? record.agent : {};
  const agent = {
    ...rawAgent,
    id: stringValue(rawAgent.id) ?? stringValue(record.agent) ?? "",
  } as AnthropicDeployment["agent"];
  return {
    id,
    agent,
    archived_at: nullableStringValue(record.archived_at),
    created_at: stringValue(record.created_at) ?? now,
    description: nullableStringValue(record.description),
    environment_id: stringValue(record.environment_id) ?? "",
    initial_events: arrayValue(record.initial_events),
    metadata: stringRecord(record.metadata),
    name: stringValue(record.name) ?? id,
    paused_reason: record.paused_reason ?? null,
    resources: arrayValue(record.resources),
    schedule: record.schedule ?? null,
    status: stringValue(record.status) ?? "active",
    type: "deployment",
    updated_at: stringValue(record.updated_at) ?? now,
    vault_ids: stringArray(record.vault_ids),
  };
}

function normalizeManagedSession(value: unknown): ManagedSession {
  const record = isRecord(value) ? value : {};
  const now = new Date().toISOString();
  const id = stringValue(record.id) ?? crypto.randomUUID();
  const agent = isRecord(record.agent) ? record.agent : {};
  const status = stringValue(record.status);
  return {
    id,
    agent: {
      id: stringValue(agent.id) ?? stringValue(record.agent) ?? "",
      name: stringValue(agent.name) ?? stringValue(agent.id) ?? "Agent",
      version: numberValue(agent.version) ?? 1,
      model: (agent.model as ManagedSession["agent"]["model"]) ?? null,
    },
    archived_at: nullableStringValue(record.archived_at),
    created_at: stringValue(record.created_at) ?? now,
    deployment_id: nullableStringValue(record.deployment_id),
    environment_id: stringValue(record.environment_id) ?? "",
    metadata: isRecord(record.metadata) ? stringRecord(record.metadata) : null,
    stats: isRecord(record.stats) ? record.stats as ManagedSession["stats"] : null,
    status: status === "running" || status === "rescheduling" || status === "terminated" ? status : "idle",
    title: nullableStringValue(record.title),
    updated_at: stringValue(record.updated_at) ?? now,
    usage: isRecord(record.usage) ? record.usage as ManagedSession["usage"] : null,
    vault_ids: stringArray(record.vault_ids),
  };
}

async function sendAnthropicChat(anthropic: AnthropicProxyApi, body: unknown): Promise<{ sessionId: string; messages: string[]; awaitingApproval?: ChatApprovalWait | null }> {
  const payload = isRecord(body) ? body : {};
  const agentId = stringValue(payload.agentId);
  const environmentId = stringValue(payload.environment_id);
  const sessionId = stringValue(payload.sessionId);
  const message = stringValue(payload.message)?.trim();
  if (!agentId) throw new ApiError("Select an Anthropic agent before starting a session.", 400);
  if (!message) throw new ApiError("Enter a message before starting a session.", 400);
  const event = userMessageEvent(message);
  const payloadVaultIds = stringArray(payload.vault_ids);
  const sessionVaultIds = sessionId
    ? []
    : payloadVaultIds.length > 0
      ? payloadVaultIds
      : await defaultVaultIdsForPayloadProject(anthropic, stringValue(payload.project_id));
  const nextSessionId = sessionId ?? stringValue((await anthropic.createSession({
    agent: agentId,
    environment_id: environmentId,
    vault_ids: sessionVaultIds,
    initial_events: [event],
    metadata: {
      ...(stringValue(payload.project_id) ? { canvas_project_id: stringValue(payload.project_id) } : {}),
      ...(stringValue(payload.trigger_node_id) ? { canvas_trigger_node_id: stringValue(payload.trigger_node_id) } : {}),
    },
  }) as JsonObject).id);
  if (!nextSessionId) throw new ApiError("Anthropic did not return a session id.", 502);
  if (sessionId) await anthropic.sendSessionEvents(sessionId, [event]);
  const messages = await waitForAssistantMessages(anthropic, nextSessionId);
  return {
    sessionId: nextSessionId,
    messages: messages.length > 0 ? messages.slice(-2) : ["Session started. Refresh the session panel to load new Anthropic events."],
    awaitingApproval: null,
  };
}

async function sendAnthropicApproval(anthropic: AnthropicProxyApi, body: unknown): Promise<{ sessionId: string; messages: string[]; awaitingApproval?: ChatApprovalWait | null }> {
  const payload = isRecord(body) ? body : {};
  const sessionId = stringValue(payload.sessionId);
  const toolUseId = stringValue(payload.tool_use_id);
  const result = payload.result === "allow" ? "allow" : "deny";
  if (!sessionId || !toolUseId) throw new ApiError("Missing approval session or tool id.", 400);
  await anthropic.sendSessionEvents(sessionId, [{ type: "user.tool_confirmation", tool_use_id: toolUseId, result }]);
  return { sessionId, messages: await waitForAssistantMessages(anthropic, sessionId), awaitingApproval: null };
}

async function waitForAssistantMessages(anthropic: AnthropicProxyApi, sessionId: string): Promise<string[]> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) await sleep(900);
    const messages = eventsToChatMessages(await anthropic.listSessionEvents(sessionId))
      .filter((message) => message.role === "assistant")
      .map((message) => message.content)
      .filter(Boolean);
    if (messages.length > 0) return messages;
  }
  return [];
}

function eventsToChatMessages(events: unknown[]): Array<{ role: "user" | "assistant"; content: string }> {
  return events.flatMap((event): Array<{ role: "user" | "assistant"; content: string }> => {
    if (!isRecord(event)) return [];
    const type = stringValue(event.type) ?? "";
    const content = eventText(event);
    if (!content) return [];
    if (type === "user.message") return [{ role: "user" as const, content }];
    if (type.startsWith("agent.") || type.startsWith("assistant.")) return [{ role: "assistant" as const, content }];
    return [];
  });
}

function userMessageEvent(text: string): JsonObject {
  return {
    type: "user.message",
    content: [{ type: "text", text }],
  };
}

function eventText(event: JsonObject): string {
  const direct = textFromContent(event.content);
  if (direct) return direct;
  if (isRecord(event.message)) return textFromContent(event.message.content) || stringValue(event.message.text) || "";
  if (typeof event.text === "string") return event.text;
  return "";
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.flatMap((block) => {
    if (!isRecord(block)) return [];
    if (typeof block.text === "string") return [block.text];
    if (typeof block.content === "string") return [block.content];
    if (typeof block.name === "string" && stringValue(block.type)?.includes("tool")) return [`Tool: ${block.name}`];
    return [];
  }).join("\n\n").trim();
}

async function localAvailableVaults(anthropic: AnthropicProxyApi): Promise<VaultRecord[]> {
  try {
    return (await anthropic.listVaults()).map(normalizeVault).filter((vault) => !vault.archived_at);
  } catch {
    return [];
  }
}

async function localAvailableEnvironments(anthropic: AnthropicProxyApi): Promise<AnthropicEnvironment[]> {
  try {
    return (await anthropic.listEnvironments()).map(normalizeEnvironment).filter((environment) => !environment.archived_at);
  } catch {
    return [];
  }
}

async function firstAvailableAnthropicVaultId(anthropic: AnthropicProxyApi): Promise<string | null> {
  return (await localAvailableVaults(anthropic))[0]?.id ?? null;
}

async function firstAvailableAnthropicEnvironmentId(anthropic: AnthropicProxyApi): Promise<string | null> {
  return (await localAvailableEnvironments(anthropic))[0]?.id ?? null;
}

async function selectedVaultIdForProjectIds(anthropic: AnthropicProxyApi, projectIds: string[]): Promise<string | null> {
  const projectId = projectIds[0];
  if (!projectId) return firstAvailableAnthropicVaultId(anthropic);
  const project = (await localCanvasStore.listProjects<ProjectRecord>()).find((candidate) => candidate.id === projectId);
  return project ? selectedVaultIdForProject(anthropic, project) : firstAvailableAnthropicVaultId(anthropic);
}

async function selectedVaultIdForProject(anthropic: AnthropicProxyApi, project: ProjectRecord): Promise<string | null> {
  return (await selectedVaultIdsForProject(anthropic, project))[0] ?? null;
}

async function selectedVaultIdsForProject(anthropic: AnthropicProxyApi, project: ProjectRecord): Promise<string[]> {
  return projectVaultIds(project, await localAvailableVaults(anthropic));
}

async function defaultVaultIdsForPayloadProject(anthropic: AnthropicProxyApi, projectId: string | undefined): Promise<string[]> {
  if (!projectId) {
    const fallbackVaultId = await firstAvailableAnthropicVaultId(anthropic);
    return fallbackVaultId ? [fallbackVaultId] : [];
  }
  const project = (await localCanvasStore.listProjects<ProjectRecord>()).find((candidate) => candidate.id === projectId);
  if (project) return selectedVaultIdsForProject(anthropic, project);
  const fallbackVaultId = await firstAvailableAnthropicVaultId(anthropic);
  return fallbackVaultId ? [fallbackVaultId] : [];
}

async function createLocalMcpCredentialIfNeeded(
  anthropic: AnthropicProxyApi,
  auth: JsonObject,
  authType: McpAuthKind,
  mcpServerUrl: string,
  displayName: string,
  vaultId: string | null,
): Promise<{ vaultId: string | null; credentialId: string | null }> {
  if (authType === "no_auth") return { vaultId: null, credentialId: null };
  if (!vaultId) throw new ApiError("Select an Anthropic vault in project settings before adding authenticated MCP servers.", 400);
  const credentialAuths = localMcpCredentialAuths(auth, authType, mcpServerUrl);
  const credentials: VaultCredential[] = [];
  for (const credentialAuth of credentialAuths) {
    const credentialName = credentialAuth.type === "environment_variable" && typeof credentialAuth.secret_name === "string"
      ? `${displayName} ${credentialAuth.secret_name}`
      : displayName;
    credentials.push(normalizeVaultCredential(await anthropic.createVaultCredential(vaultId, { display_name: credentialName, auth: credentialAuth })));
  }
  return { vaultId, credentialId: credentials[0]?.id ?? null };
}

function localMcpCredentialAuths(auth: JsonObject, authType: McpAuthKind, mcpServerUrl: string): JsonObject[] {
  if (authType === "static_bearer") {
    const token = stringValue(auth.token)?.trim();
    if (!token) throw new ApiError("Bearer token is required.", 400);
    return [{ type: "static_bearer", token, mcp_server_url: normalizeMcpTemplateUrl(mcpServerUrl) }];
  }
  if (authType !== "environment_variable") return [];
  const rawVariables = Array.isArray(auth.variables) ? auth.variables : [auth];
  const allowedHosts = stringArray(auth.allowed_hosts ?? auth.allowedHosts);
  const defaultAllowedHosts = mcpServerAllowedHosts(mcpServerUrl);
  return rawVariables.map((rawVariable, index) => {
    if (!isRecord(rawVariable)) throw new ApiError(`Environment variable ${index + 1} must be an object.`, 400);
    const secretName = stringValue(rawVariable.secret_name) ?? stringValue(rawVariable.secretName);
    const secretValue = stringValue(rawVariable.secret_value) ?? stringValue(rawVariable.secretValue);
    if (!secretName?.trim()) throw new ApiError(`Environment variable ${index + 1} needs a name.`, 400);
    if (!secretValue) throw new ApiError(`Environment variable ${index + 1} needs a value.`, 400);
    return {
      type: "environment_variable",
      secret_name: secretName.trim(),
      secret_value: secretValue,
      networking: { type: "limited", allowed_hosts: allowedHosts.length > 0 ? allowedHosts : defaultAllowedHosts },
    };
  });
}

async function listLocalMcpServers(): Promise<RegisteredMcpServer[]> {
  const presets = normalizePresetMcpServers();
  const stored = await localCanvasStore.listMcpServers<RegisteredMcpServer>();
  const storedIds = new Set(stored.map((server) => server.id));
  return [...stored, ...presets.filter((server) => !storedIds.has(server.id))];
}

async function saveLocalMcpServer(anthropic: AnthropicProxyApi, body: unknown): Promise<RegisteredMcpServer> {
  const value = isRecord(body) ? body : {};
  const now = new Date().toISOString();
  const existing = stringValue(value.id)
    ? (await localCanvasStore.listMcpServers<RegisteredMcpServer>()).find((server) => server.id === stringValue(value.id))
    : null;
  const auth = isRecord(value.auth) ? value.auth : null;
  const authType = mcpAuthKindValue(value.auth_type) ?? (auth ? mcpAuthKindValue(auth.type) : null) ?? existing?.auth_type ?? "no_auth";
  const projectIds = stringArray(value.project_ids);
  let vaultId = nullableStringValue(value.vault_id) ?? existing?.vault_id ?? null;
  let credentialId = nullableStringValue(value.credential_id) ?? existing?.credential_id ?? null;
  if (auth) {
    const credential = await createLocalMcpCredentialIfNeeded(
      anthropic,
      auth,
      authType,
      stringValue(value.url) ?? existing?.url ?? "",
      stringValue(value.name) ?? existing?.name ?? "MCP server",
      vaultId ?? await selectedVaultIdForProjectIds(anthropic, projectIds),
    );
    vaultId = credential.vaultId;
    credentialId = credential.credentialId;
  }
  const server: RegisteredMcpServer = {
    id: stringValue(value.id) ?? crypto.randomUUID(),
    name: stringValue(value.name) ?? existing?.name ?? "MCP server",
    description: nullableStringValue(value.description) ?? existing?.description ?? null,
    url: stringValue(value.url) ?? existing?.url ?? "",
    icon_data_url: nullableStringValue(value.icon_data_url) ?? existing?.icon_data_url ?? null,
    auth_type: authType,
    vault_id: vaultId,
    credential_id: credentialId,
    project_ids: projectIds,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  await localCanvasStore.saveMcpServer(server);
  return server;
}

function normalizePresetMcpServers(): RegisteredMcpServer[] {
  const catalog = presetCatalog as {
    mcpServers?: Array<Partial<RegisteredMcpServer> & { id?: string; name?: string; url?: string }>;
  };
  return (catalog.mcpServers ?? []).map((server, index) => {
    const now = new Date().toISOString();
    return {
      id: server.id ?? `preset-mcp-${index + 1}`,
      name: server.name ?? `MCP preset ${index + 1}`,
      description: server.description ?? null,
      url: server.url ?? "",
      icon_data_url: server.icon_data_url ?? null,
      auth_type: mcpAuthKindValue(server.auth_type) ?? "no_auth",
      vault_id: server.vault_id ?? null,
      credential_id: server.credential_id ?? null,
      project_ids: [],
      created_at: server.created_at ?? now,
      updated_at: server.updated_at ?? now,
    };
  });
}

function normalizePresetPackages(): PackagePresetRecord[] {
  const catalog = presetCatalog as { packages?: Array<Partial<PackagePresetRecord> & { id?: string; name?: string; package_name?: string; target?: PackageManager }> };
  return (catalog.packages ?? []).map((packagePreset, index) => {
    const now = new Date().toISOString();
    return {
      id: packagePreset.id ?? `preset-package-${index + 1}`,
      name: packagePreset.name ?? `Package preset ${index + 1}`,
      description: packagePreset.description ?? null,
      logo_data_url: packagePreset.logo_data_url ?? null,
      package_name: packagePreset.package_name ?? "",
      target: packageManagers.includes(packagePreset.target as PackageManager) ? packagePreset.target as PackageManager : "pip",
      environment_variables: Array.isArray(packagePreset.environment_variables) ? packagePreset.environment_variables.filter((value): value is string => typeof value === "string") : [],
      created_at: packagePreset.created_at ?? now,
      updated_at: packagePreset.updated_at ?? now,
    };
  });
}

function normalizePresetTutorials(): TutorialRecord[] {
  const catalog = presetCatalog as { tutorials?: Array<Partial<TutorialRecord> & { id?: string; title?: string; markdown?: string }> };
  return (catalog.tutorials ?? []).map((tutorial, index) => {
    const now = new Date().toISOString();
    return {
      id: tutorial.id ?? `preset-tutorial-${index + 1}`,
      title: tutorial.title ?? `Tutorial ${index + 1}`,
      description: tutorial.description ?? null,
      logo_data_url: tutorial.logo_data_url ?? null,
      markdown: tutorial.markdown ?? "",
      created_at: tutorial.created_at ?? now,
      updated_at: tutorial.updated_at ?? now,
    };
  });
}

async function installLocalPackagePreset(anthropic: AnthropicProxyApi, projectId: string, packagePresetId: string, body: unknown): Promise<{ packagePreset: PackagePresetRecord; environment: AnthropicEnvironment; credentialIds: string[] }> {
  const packagePreset = normalizePresetPackages().find((candidate) => candidate.id === packagePresetId);
  if (!packagePreset) throw new ApiError("Package preset not found.", 404);
  const projects = await localCanvasStore.listProjects<ProjectRecord>();
  const project = projects.find((candidate) => candidate.id === projectId);
  if (!project) throw new ApiError("Project not found.", 404);
  const selectedVaultId = await selectedVaultIdForProject(anthropic, project);
  const existingVaultCredentials = selectedVaultId ? (await anthropic.listVaultCredentials(selectedVaultId)).map(normalizeVaultCredential) : [];
  const environmentValues = packageInstallEnvironmentValues(body, packagePreset.environment_variables, existingVaultCredentials);
  if (packagePreset.environment_variables.length > 0 && !selectedVaultId) {
    throw new ApiError("Select an Anthropic vault in project settings before installing package environment values.", 400);
  }
  const environments = (await anthropic.listEnvironments()).map(normalizeEnvironment);
  const environment = environments.find((candidate) => candidate.id === project.anthropic_environment_id) ?? environments[0];
  if (!environment) throw new ApiError("Create an Anthropic environment before installing package presets.", 400);
  const config = isRecord(environment.config) ? structuredClone(environment.config) as JsonObject : defaultEnvironmentConfig("cloud");
  const packages: Record<string, unknown> = isRecord(config.packages) ? { ...config.packages } : { type: "packages" };
  const currentPackages = Array.isArray(packages[packagePreset.target]) ? packages[packagePreset.target] as string[] : [];
  packages[packagePreset.target] = uniqueStrings([...currentPackages, packagePreset.package_name].filter(Boolean));
  config.packages = packages;
  const updated = normalizeEnvironment(await anthropic.updateEnvironment(environment.id, {
    name: environment.name,
    description: environment.description,
    config,
    metadata: environment.metadata,
  }));
  if (project.anthropic_environment_id !== updated.id) {
    await localCanvasStore.saveProject({ ...project, anthropic_environment_id: updated.id, updated_at: new Date().toISOString() });
  }
  const credentialIds = await createLocalPackageEnvironmentCredentials(anthropic, project, packagePreset, environmentValues, selectedVaultId);
  return { packagePreset, environment: updated, credentialIds };
}

function packageInstallEnvironmentValues(body: unknown, requiredNames: string[], existingCredentials: VaultCredential[] = []): Record<string, string> {
  if (requiredNames.length === 0) return {};
  const missingNames = requiredNames.filter((name) => !vaultHasEnvironmentCredential(existingCredentials, name));
  if (missingNames.length === 0) return {};
  const payload = isRecord(body) ? body : {};
  const rawValues = isRecord(payload.environment_values)
    ? payload.environment_values
    : isRecord(payload.environmentValues)
      ? payload.environmentValues
      : null;
  if (!rawValues) throw new ApiError("Environment values are required.", 400);
  const values: Record<string, string> = {};
  for (const name of missingNames) {
    const value = stringValue(rawValues[name]);
    if (!value) throw new ApiError(`Environment value ${name} is required.`, 400);
    values[name] = value;
  }
  return values;
}

async function createLocalPackageEnvironmentCredentials(
  anthropic: AnthropicProxyApi,
  project: ProjectRecord,
  packagePreset: PackagePresetRecord,
  environmentValues: Record<string, string>,
  selectedVaultId?: string | null,
): Promise<string[]> {
  const entries = Object.entries(environmentValues);
  if (entries.length === 0) return [];
  const vaultId = selectedVaultId ?? await selectedVaultIdForProject(anthropic, project);
  if (!vaultId) throw new ApiError("Select an Anthropic vault in project settings before installing package environment values.", 400);
  const credentialIds: string[] = [];
  for (const [secretName, secretValue] of entries) {
    const credential = normalizeVaultCredential(await anthropic.createVaultCredential(vaultId, {
      display_name: `${packagePreset.name} ${secretName}`,
      auth: {
        type: "environment_variable",
        secret_name: secretName,
        secret_value: secretValue,
        networking: { type: "unrestricted" },
      },
      metadata: {
        project_id: project.id,
        package_preset_id: packagePreset.id,
        package_name: packagePreset.package_name,
      },
    }));
    credentialIds.push(credential.id);
  }
  return credentialIds;
}

function normalizeSkill(value: unknown): SkillRecord {
  const record = isRecord(value) ? value : {};
  const now = new Date().toISOString();
  const id = stringValue(record.id) ?? crypto.randomUUID();
  return {
    id,
    display_title: nullableStringValue(record.display_title) ?? nullableStringValue(record.name) ?? id,
    description: nullableStringValue(record.description),
    latest_version: nullableStringValue(record.latest_version) ?? nullableStringValue(record.version),
    project_ids: [],
    source: stringValue(record.source) ?? "anthropic",
    type: stringValue(record.type) ?? "skill",
    created_at: stringValue(record.created_at) ?? now,
    updated_at: stringValue(record.updated_at) ?? now,
  };
}

function normalizeVault(value: unknown): VaultRecord {
  const record = isRecord(value) ? value : {};
  const now = new Date().toISOString();
  const id = stringValue(record.id) ?? crypto.randomUUID();
  return {
    id,
    archived_at: nullableStringValue(record.archived_at),
    can_add_credentials: record.can_add_credentials !== false,
    can_delete_credentials: record.can_delete_credentials !== false,
    can_delete_vault: record.can_delete_vault !== false,
    created_at: stringValue(record.created_at) ?? now,
    display_name: stringValue(record.display_name) ?? stringValue(record.name) ?? id,
    managed_scope: record.managed_scope === "project" || record.managed_scope === "external" ? record.managed_scope : "global",
    metadata: stringRecord(record.metadata),
    project_id: nullableStringValue(record.project_id),
    project_name: nullableStringValue(record.project_name),
    runtime_selectable: record.runtime_selectable !== false,
    type: "vault",
    updated_at: stringValue(record.updated_at) ?? now,
  };
}

function normalizeVaultCredential(value: unknown): VaultCredential {
  const record = isRecord(value) ? value : {};
  const now = new Date().toISOString();
  const id = stringValue(record.id) ?? crypto.randomUUID();
  return {
    id,
    archived_at: nullableStringValue(record.archived_at),
    auth: credentialAuth(record.auth, record.type),
    created_at: stringValue(record.created_at) ?? now,
    display_name: nullableStringValue(record.display_name) ?? nullableStringValue(record.name),
    metadata: stringRecord(record.metadata),
    type: "vault_credential",
    updated_at: stringValue(record.updated_at) ?? now,
    vault_id: stringValue(record.vault_id) ?? "",
  };
}

function environmentConfig(value: unknown): AnthropicEnvironment["config"] {
  const config = isRecord(value) ? value : defaultEnvironmentConfig("cloud");
  return {
    ...config,
    type: stringValue(config.type) ?? "cloud",
  };
}

function credentialAuth(auth: unknown, fallbackType: unknown): VaultCredential["auth"] {
  const value = isRecord(auth) ? auth : {};
  return {
    ...value,
    type: stringValue(value.type) ?? stringValue(fallbackType) ?? "credential",
  };
}

function mcpAuthKindValue(value: unknown): McpAuthKind | null {
  return value === "no_auth" || value === "static_bearer" || value === "environment_variable" ? value : null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function nullableStringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function stringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, recordValue]) =>
      typeof recordValue === "string" ? [[key, recordValue]] : recordValue == null ? [] : [[key, JSON.stringify(recordValue)]],
    ),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function isUnauthorized(error: unknown): boolean {
  return (error instanceof ApiError || error instanceof AnthropicApiError) && error.status === 401;
}

function isConflict(error: unknown): boolean {
  return (error instanceof ApiError || error instanceof AnthropicApiError) && error.status === 409;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

function readIconFile(file: File): Promise<string> {
  const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);
  if (!allowedTypes.has(file.type)) throw new Error("Icon must be a PNG, JPEG, WebP, GIF, or SVG image.");
  if (file.size > 256 * 1024) throw new Error("Icon must be smaller than 256 KB.");

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Could not read icon image."));
      }
    };
    reader.onerror = () => reject(new Error("Could not read icon image."));
    reader.readAsDataURL(file);
  });
}

interface ServerLocalSettings {
  selectedProjectId?: string;
  canvasViewports?: CanvasViewportsByProject;
  paletteAgentSections?: { global: boolean; project: boolean };
  paletteMcpSections?: { global: boolean; project: boolean };
  paletteSkillSections?: { builtIn: boolean; global: boolean; project: boolean };
}

async function readStoredAuth(): Promise<AuthSession | null> {
  const serverSession = await readAnthropicProxySession<AuthSession>().catch(() => null);
  if (serverSession) return serverSession;

  const apiKey = await readStoredAnthropicApiKey().catch(() => null);
  if (!apiKey) return null;

  try {
    const migratedSession = await createAnthropicProxySession<AuthSession>(apiKey);
    await clearStoredAnthropicApiKey();
    return migratedSession;
  } catch {
    await clearLocalAuthStorage();
    return null;
  }
}

async function writeStoredAuth(auth: AuthSession): Promise<void> {
  void auth;
}

async function clearLocalAuthStorage(): Promise<void> {
  localStorage.removeItem(authStorageKey);
  localStorage.removeItem(legacyCanvasLocalAuthStorageKey);
  localStorage.removeItem(legacyAuthStorageKey);
  await Promise.allSettled([clearStoredAnthropicApiKey(), clearAnthropicProxySession()]);
}

function workspaceRoleFromValue(value: unknown): WorkspaceRole | null {
  return value === "admin" || value === "member" ? value : null;
}

function workspaceRoleLabel(role: WorkspaceRole): string {
  return role === "admin" ? "Admin" : "Member";
}

function clearStoredAuth() {
  void clearLocalAuthStorage();
}

async function readServerLocalSettings(): Promise<ServerLocalSettings> {
  const response = await fetch("/api/local-store/settings", { credentials: "same-origin" });
  const payload = await response.json().catch(() => ({})) as unknown;
  if (!response.ok) throw new Error(errorMessageFromLocalSettingsPayload(payload) ?? `Settings request failed with ${response.status}`);
  return isRecord(payload) && isRecord(payload.settings) ? normalizeServerLocalSettings(payload.settings) : {};
}

function patchServerLocalSettings(settings: ServerLocalSettings): void {
  void fetch("/api/local-store/settings", {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(settings),
  }).catch(() => undefined);
}

function normalizeServerLocalSettings(value: JsonObject): ServerLocalSettings {
  return {
    ...(typeof value.selectedProjectId === "string" ? { selectedProjectId: value.selectedProjectId } : {}),
    ...(isRecord(value.canvasViewports) ? { canvasViewports: normalizeCanvasViewports(value.canvasViewports) } : {}),
    ...(isRecord(value.paletteAgentSections) ? { paletteAgentSections: {
      global: typeof value.paletteAgentSections.global === "boolean" ? value.paletteAgentSections.global : true,
      project: typeof value.paletteAgentSections.project === "boolean" ? value.paletteAgentSections.project : true,
    } } : {}),
    ...(isRecord(value.paletteMcpSections) ? { paletteMcpSections: {
      global: typeof value.paletteMcpSections.global === "boolean" ? value.paletteMcpSections.global : true,
      project: typeof value.paletteMcpSections.project === "boolean" ? value.paletteMcpSections.project : true,
    } } : {}),
    ...(isRecord(value.paletteSkillSections) ? { paletteSkillSections: {
      builtIn: typeof value.paletteSkillSections.builtIn === "boolean" ? value.paletteSkillSections.builtIn : true,
      global: typeof value.paletteSkillSections.global === "boolean" ? value.paletteSkillSections.global : true,
      project: typeof value.paletteSkillSections.project === "boolean" ? value.paletteSkillSections.project : true,
    } } : {}),
  };
}

function cacheServerLocalSettings(settings: ServerLocalSettings): void {
  if (typeof settings.selectedProjectId === "string") cacheSelectedProjectId(settings.selectedProjectId);
  if (settings.canvasViewports) cacheCanvasViewports(settings.canvasViewports);
  if (settings.paletteAgentSections) cacheJsonSetting(paletteAgentSectionsStorageKey, legacyPaletteAgentSectionsStorageKey, settings.paletteAgentSections);
  if (settings.paletteMcpSections) cacheJsonSetting(paletteMcpSectionsStorageKey, legacyPaletteMcpSectionsStorageKey, settings.paletteMcpSections);
  if (settings.paletteSkillSections) cacheJsonSetting(paletteSkillSectionsStorageKey, legacyPaletteSkillSectionsStorageKey, settings.paletteSkillSections);
}

function errorMessageFromLocalSettingsPayload(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const error = payload.error;
  if (typeof error === "string") return error;
  if (isRecord(error) && typeof error.message === "string") return error.message;
  return typeof payload.message === "string" ? payload.message : null;
}

function readProjectIdFromPath(): string | null {
  const match = window.location.pathname.match(/^\/project\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function removeProjectPathFromUrl() {
  if (!readProjectIdFromPath()) return;
  window.history.replaceState(null, "", `/${window.location.search}${window.location.hash}`);
}

function canEditProject(project: ProjectRecord): boolean {
  return project.current_user_role !== "viewer";
}

function readStoredSelectedProjectId(): string {
  const stored = localStorage.getItem(selectedProjectStorageKey);
  if (stored) return stored;
  const legacyStored = localStorage.getItem(legacySelectedProjectStorageKey) ?? "";
  if (legacyStored) {
    cacheSelectedProjectId(legacyStored);
  }
  return legacyStored;
}

function storeSelectedProjectId(projectId: string) {
  cacheSelectedProjectId(projectId);
  patchServerLocalSettings({ selectedProjectId: projectId });
}

function cacheSelectedProjectId(projectId: string) {
  if (projectId) {
    localStorage.setItem(selectedProjectStorageKey, projectId);
    localStorage.removeItem(legacySelectedProjectStorageKey);
  } else {
    localStorage.removeItem(selectedProjectStorageKey);
    localStorage.removeItem(legacySelectedProjectStorageKey);
  }
}

function readStoredCanvasViewports(): CanvasViewportsByProject {
  const raw = localStorage.getItem(canvasViewportsStorageKey);
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    return isRecord(value) ? normalizeCanvasViewports(value) : {};
  } catch {
    localStorage.removeItem(canvasViewportsStorageKey);
    return {};
  }
}

function cacheCanvasViewports(viewports: CanvasViewportsByProject) {
  localStorage.setItem(canvasViewportsStorageKey, JSON.stringify(viewports));
}

function normalizeCanvasViewports(value: JsonObject): CanvasViewportsByProject {
  return Object.fromEntries(
    Object.entries(value)
      .map(([projectId, viewport]) => [projectId, normalizeCanvasViewport(viewport)] as const)
      .filter((entry): entry is [string, CanvasViewport] => Boolean(entry[0] && entry[1])),
  );
}

function normalizeCanvasViewport(value: unknown): CanvasViewport | null {
  if (!isRecord(value)) return null;
  if (typeof value.x !== "number" || typeof value.y !== "number" || typeof value.zoom !== "number") return null;
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y) || !Number.isFinite(value.zoom)) return null;
  return {
    x: roundCanvasViewportValue(value.x),
    y: roundCanvasViewportValue(value.y),
    zoom: roundCanvasViewportValue(Math.min(2.2, Math.max(0.35, value.zoom)), 1000),
  };
}

function roundCanvasViewportValue(value: number, factor = 100): number {
  return Math.round(value * factor) / factor;
}

function canvasViewportsEqual(left: CanvasViewport | undefined, right: CanvasViewport | undefined): boolean {
  return Boolean(left && right && left.x === right.x && left.y === right.y && left.zoom === right.zoom);
}

function cacheJsonSetting(storageKey: string, legacyStorageKey: string, value: unknown) {
  localStorage.setItem(storageKey, JSON.stringify(value));
  localStorage.removeItem(legacyStorageKey);
}

function readMigratedLocalStorageValue(storageKey: string, legacyStorageKey: string): string | null {
  const stored = localStorage.getItem(storageKey);
  if (stored) return stored;
  const legacyStored = localStorage.getItem(legacyStorageKey);
  if (legacyStored) {
    localStorage.setItem(storageKey, legacyStored);
    localStorage.removeItem(legacyStorageKey);
  }
  return legacyStored;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function readPaletteAgentSections(): { global: boolean; project: boolean } {
  const raw = readMigratedLocalStorageValue(paletteAgentSectionsStorageKey, legacyPaletteAgentSectionsStorageKey);
  if (!raw) return { global: true, project: true };
  try {
    const value = JSON.parse(raw) as unknown;
    if (isRecord(value)) {
      return {
        global: typeof value.global === "boolean" ? value.global : true,
        project: typeof value.project === "boolean" ? value.project : true,
      };
    }
  } catch {
    localStorage.removeItem(paletteAgentSectionsStorageKey);
    localStorage.removeItem(legacyPaletteAgentSectionsStorageKey);
  }
  return { global: true, project: true };
}

function writePaletteAgentSections(value: { global: boolean; project: boolean }) {
  cacheJsonSetting(paletteAgentSectionsStorageKey, legacyPaletteAgentSectionsStorageKey, value);
  patchServerLocalSettings({ paletteAgentSections: value });
}

function readPaletteMcpSections(): { global: boolean; project: boolean } {
  const raw = readMigratedLocalStorageValue(paletteMcpSectionsStorageKey, legacyPaletteMcpSectionsStorageKey);
  if (!raw) return { global: true, project: true };
  try {
    const value = JSON.parse(raw) as unknown;
    if (isRecord(value)) {
      return {
        global: typeof value.global === "boolean" ? value.global : true,
        project: typeof value.project === "boolean" ? value.project : true,
      };
    }
  } catch {
    localStorage.removeItem(paletteMcpSectionsStorageKey);
    localStorage.removeItem(legacyPaletteMcpSectionsStorageKey);
  }
  return { global: true, project: true };
}

function writePaletteMcpSections(value: { global: boolean; project: boolean }) {
  cacheJsonSetting(paletteMcpSectionsStorageKey, legacyPaletteMcpSectionsStorageKey, value);
  patchServerLocalSettings({ paletteMcpSections: value });
}

function readPaletteSkillSections(): { builtIn: boolean; global: boolean; project: boolean } {
  const raw = readMigratedLocalStorageValue(paletteSkillSectionsStorageKey, legacyPaletteSkillSectionsStorageKey);
  if (!raw) return { builtIn: true, global: true, project: true };
  try {
    const value = JSON.parse(raw) as unknown;
    if (isRecord(value)) {
      return {
        builtIn: typeof value.builtIn === "boolean" ? value.builtIn : true,
        global: typeof value.global === "boolean" ? value.global : typeof value.custom === "boolean" ? value.custom : true,
        project: typeof value.project === "boolean" ? value.project : true,
      };
    }
  } catch {
    localStorage.removeItem(paletteSkillSectionsStorageKey);
    localStorage.removeItem(legacyPaletteSkillSectionsStorageKey);
  }
  return { builtIn: true, global: true, project: true };
}

function writePaletteSkillSections(value: { builtIn: boolean; global: boolean; project: boolean }) {
  cacheJsonSetting(paletteSkillSectionsStorageKey, legacyPaletteSkillSectionsStorageKey, value);
  patchServerLocalSettings({ paletteSkillSections: value });
}

function agentProjectIdsFromMetadata(metadata: Record<string, string>): string[] {
  return uniqueStrings([...parseDelimitedMetadata(metadata.project_ids), ...parseDelimitedMetadata(metadata.project_id)]);
}

function parseDelimitedMetadata(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function agentIsGlobal(agent: Agent): boolean {
  return agentProjectIdsFromMetadata(agent.metadata).length === 0;
}

function agentInProject(agent: Agent, projectId: string): boolean {
  return agentProjectIdsFromMetadata(agent.metadata).includes(projectId);
}

function skillIsBuiltIn(skill: SkillRecord): boolean {
  return skill.source === "anthropic";
}

function skillProjectIds(skill: SkillRecord): string[] {
  return skill.project_ids ?? [];
}

function skillIsGlobal(skill: SkillRecord): boolean {
  return skillProjectIds(skill).length === 0;
}

function skillInProject(skill: SkillRecord, projectId: string): boolean {
  return skillProjectIds(skill).includes(projectId);
}

function mcpServerIsGlobal(server: RegisteredMcpServer): boolean {
  return (server.project_ids ?? []).length === 0;
}

function mcpServerMatchesIntegrationTemplate(server: RegisteredMcpServer, integration: IntegrationRecord): boolean {
  return (
    normalizeMcpTemplateUrl(server.url) === normalizeMcpTemplateUrl(integration.mcp_server_url) ||
    server.name.startsWith(`${integration.name} `)
  );
}

function mcpServerFromIntegrationTemplate(integration: IntegrationRecord): RegisteredMcpServer {
  const now = new Date().toISOString();
  return {
    id: `integration-${integration.id}`,
    name: integration.name,
    description: integration.description,
    url: integration.mcp_server_url,
    icon_data_url: integration.logo_data_url,
    auth_type: integration.mcp_auth_type,
    vault_id: null,
    credential_id: null,
    project_ids: [],
    created_at: now,
    updated_at: now,
  };
}

function mcpInstallAuthPayload(server: RegisteredMcpServer, values: { token: string; secretName: string; secretValue: string }): JsonObject {
  if (server.auth_type === "no_auth") return { type: "no_auth" };
  if (server.auth_type === "static_bearer") {
    const token = values.token.trim();
    if (!token) throw new Error("Bearer token is required.");
    return { type: "static_bearer", token, mcp_server_url: normalizeMcpTemplateUrl(server.url) };
  }
  const secretName = values.secretName.trim();
  if (!secretName) throw new Error("Secret name is required.");
  if (!values.secretValue) throw new Error("Secret value is required.");
  return {
    type: "environment_variable",
    secret_name: secretName,
    secret_value: values.secretValue,
    allowed_hosts: mcpServerAllowedHosts(server.url),
  };
}

function mcpServerRequiredCredentialInstalled(server: RegisteredMcpServer, credentials: VaultCredential[]): boolean {
  if (server.auth_type === "static_bearer") {
    const serverUrl = normalizeMcpTemplateUrl(server.url);
    return activeVaultCredentials(credentials).some((credential) =>
      credential.auth.type === "static_bearer" &&
      normalizeMcpTemplateUrl(stringValue(credential.auth.mcp_server_url) ?? "") === serverUrl,
    );
  }

  if (server.auth_type === "environment_variable") {
    const [host] = mcpServerAllowedHosts(server.url);
    if (!host) return false;
    return activeVaultCredentials(credentials).some((credential) =>
      credential.auth.type === "environment_variable" && environmentCredentialMatchesHost(credential.auth, host),
    );
  }

  return false;
}

function canvasMcpInstallStatus(
  server: RegisteredMcpServer,
  selectedVaultId: string,
  credentials: VaultCredential[],
  credentialsLoading: boolean,
): "installed" | "missing" | "loading" {
  if (server.auth_type === "no_auth") return "installed";
  if (credentialsLoading) return "loading";
  if (!selectedVaultId) return "missing";
  return mcpServerRequiredCredentialInstalled(server, credentials) ? "installed" : "missing";
}

function environmentCredentialMatchesHost(auth: VaultCredential["auth"], host: string): boolean {
  const allowedHosts = credentialAllowedHosts(auth);
  return allowedHosts.some((allowedHost) => credentialAllowedHostMatches(host, allowedHost));
}

function credentialAllowedHosts(auth: VaultCredential["auth"]): string[] {
  const networking = isRecord(auth.networking) ? auth.networking : null;
  return uniqueStrings([...stringArray(networking?.allowed_hosts), ...stringArray(auth.allowed_hosts)]);
}

function credentialAllowedHostMatches(host: string, allowedHost: string): boolean {
  const normalizedHost = normalizeHostName(host);
  const normalizedAllowedHost = normalizeAllowedHost(allowedHost);
  if (!normalizedHost || !normalizedAllowedHost) return false;
  if (normalizedAllowedHost.startsWith("*.")) {
    const baseHost = normalizedAllowedHost.slice(2);
    return normalizedHost.endsWith(`.${baseHost}`);
  }
  return normalizedHost === normalizedAllowedHost;
}

function normalizeAllowedHost(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  if (trimmed.startsWith("*.")) return `*.${normalizeHostName(trimmed.slice(2))}`;
  return normalizeHostName(trimmed);
}

function normalizeHostName(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  try {
    return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`).hostname.toLowerCase();
  } catch {
    return trimmed.split("/")[0]?.split(":")[0]?.toLowerCase() ?? "";
  }
}

function activeVaultCredentials(credentials: VaultCredential[]): VaultCredential[] {
  return credentials.filter((credential) => !credential.archived_at);
}

function normalizeMcpTemplateUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function mcpServerAllowedHosts(url: string): string[] {
  try {
    return [new URL(url).hostname].filter(Boolean);
  } catch {
    return [];
  }
}

function parseJsonObject(value: string, label: string): JsonObject {
  const parsed = JSON.parse(value || "{}") as unknown;
  if (!isRecord(parsed)) throw new Error(`${label} must be a JSON object.`);
  return parsed;
}

function parseJsonArray(value: string, label: string): unknown[] {
  const parsed = JSON.parse(value || "[]") as unknown;
  if (!Array.isArray(parsed)) throw new Error(`${label} must be a JSON array.`);
  return parsed;
}

function mcpServerDraftFromRegistered(server: RegisteredMcpServer, id: string = crypto.randomUUID()): McpServerDraft {
  return { id, registryId: server.id, name: server.name, url: server.url };
}

function createMcpServerDraft(registeredServers: RegisteredMcpServer[] = []): McpServerDraft {
  const first = registeredServers[0];
  return first ? mcpServerDraftFromRegistered(first) : { id: crypto.randomUUID(), registryId: "", name: "", url: "" };
}

function createSkillDraft(): SkillDraft {
  return { id: crypto.randomUUID(), type: "anthropic", skillId: "", version: "" };
}

function createSubAgentDraft(): SubAgentDraft {
  return { id: crypto.randomUUID(), agentId: "" };
}

function createDefaultAgentParameterConfig(): AgentParameterConfig {
  return { enabled: false, allowAdditional: false, parameters: [] };
}

function createAgentParameterDraft(): AgentParameterDraft {
  return { id: crypto.randomUUID(), key: "", label: "", type: "text", defaultValue: "", description: "", options: "" };
}

function createDefaultApiTriggerDraft(apiKeys: ApiKeyRecord[] = []): ApiTriggerDraft {
  return { api_key_id: apiKeys[0]?.id ?? "" };
}

function createDefaultEmailTriggerDraft(emailReceivers: EmailReceiverRecord[] = []): EmailTriggerDraft {
  return { receiver_id: emailReceivers[0]?.id ?? "" };
}

function createDefaultProjectGraph(): ProjectGraph {
  return {
    nodes: [{ id: "play", type: "play", x: 520, y: 280 }],
    edges: [],
  };
}

function cloneProject(project: ProjectRecord): ProjectRecord {
  return JSON.parse(JSON.stringify(project)) as ProjectRecord;
}

function projectEditableShape(project: ProjectRecord): Pick<ProjectRecord, "name" | "graph" | "anthropic_environment_id" | "anthropic_vault_id" | "vault_ids"> {
  const vaultIds = projectVaultIds(project, []);
  return {
    name: project.name,
    graph: project.graph,
    anthropic_environment_id: project.anthropic_environment_id ?? null,
    anthropic_vault_id: vaultIds[0] ?? null,
    vault_ids: vaultIds,
  };
}

function projectEnvironmentId(project: ProjectRecord | null | undefined, environments: AnthropicEnvironment[]): string {
  if (!project) return environments[0]?.id ?? "";
  if (project.anthropic_environment_id && environments.some((environment) => environment.id === project.anthropic_environment_id)) {
    return project.anthropic_environment_id;
  }
  return environments[0]?.id ?? "";
}

function projectVaultId(project: ProjectRecord | null | undefined, vaults: VaultRecord[]): string {
  return projectVaultIds(project, vaults)[0] ?? "";
}

function projectVaultIds(project: ProjectRecord | null | undefined, vaults: VaultRecord[]): string[] {
  if (!project) return vaults[0]?.id ? [vaults[0].id] : [];
  const explicitVaultIds = hasExplicitProjectVaultIds(project);
  const selectedVaultIds = explicitVaultIds
    ? uniqueStrings((project.vault_ids ?? []).map((vaultId) => vaultId.trim()).filter(Boolean))
    : project.anthropic_vault_id
      ? [project.anthropic_vault_id]
      : [];
  const availableVaultIds = new Set(vaults.map((vault) => vault.id));
  const validVaultIds = vaults.length > 0 ? selectedVaultIds.filter((vaultId) => availableVaultIds.has(vaultId)) : selectedVaultIds;
  if (validVaultIds.length > 0 || explicitVaultIds) return validVaultIds;
  return vaults[0]?.id ? [vaults[0].id] : [];
}

function hasExplicitProjectVaultIds(project: ProjectRecord): boolean {
  return Object.prototype.hasOwnProperty.call(project, "vault_ids");
}

function stringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function defaultProjectVaultName(project: ProjectRecord): string {
  const projectName = project.name.trim();
  return projectName ? `${projectName} vault` : "Project vault";
}

function defaultProjectEnvironmentName(project: ProjectRecord): string {
  const projectName = project.name.trim();
  return projectName ? `${projectName} environment` : "Project environment";
}

function projectNodeTypeLabel(type: ProjectNodeType): string {
  if (type === "play") return "Play";
  if (type === "schedule") return "Schedule";
  if (type === "slack") return "Slack";
  if (type === "api") return "API";
  if (type === "email") return "Email";
  if (type === "mcp") return "MCP";
  if (type === "skill") return "Skill";
  return "Agent";
}

function projectGraphBounds(graph: ProjectGraph): { x: number; y: number; width: number; height: number } {
  if (graph.nodes.length === 0) return { x: 0, y: 0, width: 720, height: 420 };
  const padding = 80;
  const nodeWidth = 240;
  const nodeHeight = 150;
  const minX = Math.min(...graph.nodes.map((node) => node.x)) - padding;
  const minY = Math.min(...graph.nodes.map((node) => node.y)) - padding;
  const maxX = Math.max(...graph.nodes.map((node) => node.x + nodeWidth)) + padding;
  const maxY = Math.max(...graph.nodes.map((node) => node.y + nodeHeight)) + padding;
  return {
    x: minX,
    y: minY,
    width: Math.max(720, maxX - minX),
    height: Math.max(420, maxY - minY),
  };
}

function edgePath(source: ProjectNode, target: ProjectNode): string {
  const sourcePoint = projectNodeCenter(source);
  const targetPoint = projectNodeCenter(target);
  const sourceX = sourcePoint.x;
  const sourceY = sourcePoint.y;
  const targetX = targetPoint.x;
  const targetY = targetPoint.y;
  const midX = (sourceX + targetX) / 2;
  return `M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`;
}

function edgeStatusPoint(source: ProjectNode, target: ProjectNode): { x: number; y: number } {
  const sourcePoint = projectNodeCenter(source);
  const targetPoint = projectNodeCenter(target);
  return {
    x: (sourcePoint.x + targetPoint.x) / 2,
    y: (sourcePoint.y + targetPoint.y) / 2,
  };
}

function connectionPreviewPath(source: ProjectNode, target: { x: number; y: number }): string {
  const sourcePoint = projectNodeCenter(source);
  const sourceX = sourcePoint.x;
  const sourceY = sourcePoint.y;
  const midX = (sourceX + target.x) / 2;
  return `M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${target.y}, ${target.x} ${target.y}`;
}

function projectNodeCenter(node: ProjectNode): { x: number; y: number } {
  if (node.type === "mcp") return { x: node.x + 74, y: node.y + 28 };
  if (node.type === "skill") return { x: node.x + 100, y: node.y + 46 };
  if (node.type === "play") return { x: node.x + 130, y: node.y + 72 };
  if (node.type === "agent") return { x: node.x + 90, y: node.y + 44 };
  if (node.type === "slack") return { x: node.x + 110, y: node.y + 74 };
  if (node.type === "api") return { x: node.x + 110, y: node.y + 74 };
  if (node.type === "email") return { x: node.x + 110, y: node.y + 74 };
  return { x: node.x + 120, y: node.y + 72 };
}

function projectEdgeTypeFor(source: ProjectNode, target: ProjectNode): ProjectEdgeType | null {
  if (source.type === "schedule" && target.type === "agent") return "schedules";
  if (source.type === "play" && target.type === "agent") return "runs";
  if (source.type === "agent" && target.type === "agent") return "sub_agent";
  if (source.type === "mcp" && target.type === "agent") return "uses_mcp";
  if (source.type === "skill" && target.type === "agent") return "uses_skill";
  if (source.type === "slack" && target.type === "agent") return "slack_triggers";
  if (source.type === "api" && target.type === "agent") return "api_triggers";
  if (source.type === "email" && target.type === "agent") return "email_triggers";
  return null;
}

function isGlobalAgentNode(node: ProjectNode, agents: AgentRecord[]): boolean {
  if (node.type !== "agent" || !node.agent_id) return false;
  const record = agents.find((candidate) => candidate.id === node.agent_id);
  return record ? agentIsGlobal(record.agent) : false;
}

function syncProjectGraphAgentDependencies(graph: ProjectGraph, agents: AgentRecord[], registeredServers: RegisteredMcpServer[]): ProjectGraph {
  let next = cloneProjectGraph(graph);
  const maxIterations = Math.max(1, agents.length + 1);

  for (let index = 0; index < maxIterations; index += 1) {
    const synced = syncProjectGraphAgentDependenciesOnce(next, agents, registeredServers);
    if (JSON.stringify(synced) === JSON.stringify(next)) return next;
    next = synced;
  }

  return next;
}

function syncProjectGraphAgentDependenciesOnce(graph: ProjectGraph, agents: AgentRecord[], registeredServers: RegisteredMcpServer[]): ProjectGraph {
  const agentById = new Map(agents.map((record) => [record.id, record]));
  let nodes = graph.nodes.map((node) => ({ ...node }));
  let edges = graph.edges.map((edge) => ({ ...edge }));
  ({ nodes, edges } = splitSharedMcpCards(nodes, edges));

  for (const source of nodes.filter((node) => node.type === "agent" && node.agent_id && agentById.has(node.agent_id))) {
    const record = agentById.get(source.agent_id ?? "");
    if (!record) continue;
    const globalAgent = agentIsGlobal(record.agent);

    const desiredSubAgentIds = globalAgent ? [] : subAgentIds(record.agent.multiagent);
    const desiredSubAgentSet = new Set(desiredSubAgentIds);
    const desiredMcpServerIds = globalAgent ? [] : mcpServerIdsFromAgent(record.agent, registeredServers);
    const desiredMcpServerSet = new Set(desiredMcpServerIds);

    edges = edges.filter((edge) => {
      if (edge.source === source.id && edge.type === "sub_agent") {
        const target = nodes.find((node) => node.id === edge.target);
        return target?.type === "agent" && target.agent_id ? desiredSubAgentSet.has(target.agent_id) : false;
      }
      if (edge.target === source.id && edge.type === "uses_mcp") {
        const mcp = nodes.find((node) => node.id === edge.source);
        if (mcp?.type !== "mcp" || !mcp.mcp_server_id) return false;
        if (mcp.synced_from_agent_id === record.id && mcp.synced_role === "mcp") {
          return desiredMcpServerSet.has(mcp.mcp_server_id);
        }
        return true;
      }
      return true;
    });

    nodes = nodes.filter((node) => {
      if (node.synced_from_agent_id !== record.id) return true;
      if (node.synced_role === "sub_agent" && node.agent_id && desiredSubAgentSet.has(node.agent_id)) return true;
      if (node.synced_role === "mcp" && node.mcp_server_id && desiredMcpServerSet.has(node.mcp_server_id)) return true;
      return edges.some((edge) => edge.source === node.id || edge.target === node.id);
    });

    desiredSubAgentIds.forEach((agentId, index) => {
      if (agentId === source.agent_id) return;
      let target = nodes.find((node) => node.type === "agent" && node.agent_id === agentId);
      if (!target) {
        target = {
          id: crypto.randomUUID(),
          type: "agent",
          agent_id: agentId,
          x: source.x + 360,
          y: source.y + index * 170,
          synced_from_agent_id: record.id,
          synced_ref_id: agentId,
          synced_role: "sub_agent",
        };
        nodes = [...nodes, target];
      }
      if (!edges.some((edge) => edge.source === source.id && edge.target === target.id && edge.type === "sub_agent")) {
        edges = [...edges, { id: crypto.randomUUID(), source: source.id, target: target.id, type: "sub_agent" }];
      }
    });

    desiredMcpServerIds.forEach((mcpServerId, index) => {
      const existingMcpNodes = nodes.filter((node) => node.type === "mcp" && node.mcp_server_id === mcpServerId);
      const hasExistingEdge = existingMcpNodes.some((mcp) => edges.some((edge) => edge.source === mcp.id && edge.target === source.id && edge.type === "uses_mcp"));
      if (hasExistingEdge) return;

      let mcp = existingMcpNodes.find((node) =>
        node.synced_from_agent_id === record.id &&
        !edges.some((edge) => edge.source === node.id && edge.type === "uses_mcp" && edge.target !== source.id),
      );
      if (!mcp) {
        mcp = existingMcpNodes.find((node) => !edges.some((edge) => edge.source === node.id && edge.type === "uses_mcp"));
      }
      if (!mcp) {
        mcp = {
          id: crypto.randomUUID(),
          type: "mcp",
          mcp_server_id: mcpServerId,
          x: source.x - 320,
          y: source.y + index * 170,
          synced_from_agent_id: record.id,
          synced_ref_id: mcpServerId,
          synced_role: "mcp",
        };
        nodes = [...nodes, mcp];
      }
      if (!edges.some((edge) => edge.source === mcp.id && edge.target === source.id && edge.type === "uses_mcp")) {
        edges = [...edges, { id: crypto.randomUUID(), source: mcp.id, target: source.id, type: "uses_mcp" }];
      }
    });
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  return {
    nodes,
    edges: edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)),
  };
}

function splitSharedMcpCards(nodes: ProjectNode[], edges: ProjectEdge[]): { nodes: ProjectNode[]; edges: ProjectEdge[] } {
  let nextNodes = nodes;
  const nextEdges = edges.map((edge) => ({ ...edge }));
  for (const mcp of nodes.filter((node) => node.type === "mcp")) {
    const mcpEdges = nextEdges.filter((edge) => edge.source === mcp.id && edge.type === "uses_mcp");
    if (mcpEdges.length <= 1) continue;
    for (const [index, edge] of mcpEdges.slice(1).entries()) {
      const target = nextNodes.find((node) => node.id === edge.target);
      const agentId = target?.type === "agent" ? target.agent_id : undefined;
      const duplicate: ProjectNode = {
        ...mcp,
        id: crypto.randomUUID(),
        x: mcp.x + 24 * (index + 1),
        y: mcp.y + 24 * (index + 1),
        synced_from_agent_id: agentId ?? mcp.synced_from_agent_id,
        synced_ref_id: mcp.mcp_server_id ?? mcp.synced_ref_id,
        synced_role: "mcp",
      };
      nextNodes = [...nextNodes, duplicate];
      edge.source = duplicate.id;
    }
  }
  return { nodes: nextNodes, edges: nextEdges };
}

function cloneProjectGraph(graph: ProjectGraph): ProjectGraph {
  return {
    nodes: graph.nodes.map((node) => ({
      ...node,
      schedule: node.schedule ? { ...node.schedule } : undefined,
      slack_trigger: node.slack_trigger ? { ...node.slack_trigger } : undefined,
      api_trigger: node.api_trigger ? { ...node.api_trigger } : undefined,
      email_trigger: node.email_trigger ? { ...node.email_trigger } : undefined,
    })),
    edges: graph.edges.map((edge) => ({ ...edge })),
  };
}

function mcpServerIdsFromAgent(agent: Agent, registeredServers: RegisteredMcpServer[]): string[] {
  return mcpServerDraftsFromAgent(agent.mcp_servers, registeredServers)
    .map((server) => server.registryId)
    .filter((id): id is string => Boolean(id));
}

function mcpServerDraftsFromAgent(value: unknown, registeredServers: RegisteredMcpServer[]): McpServerDraft[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((server) => {
    if (!isRecord(server) || server.type !== "url" || typeof server.name !== "string" || typeof server.url !== "string") {
      return [];
    }
    const registered =
      registeredServers.find((candidate) => candidate.name === server.name && candidate.url === server.url) ??
      registeredServers.find((candidate) => candidate.url === server.url) ??
      registeredServers.find((candidate) => candidate.name === server.name);
    return [
      {
        id: crypto.randomUUID(),
        registryId: registered?.id ?? "",
        name: registered?.name ?? server.name,
        url: registered?.url ?? server.url,
      },
    ];
  });
}

function skillDraftsFromAgent(value: unknown): SkillDraft[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((skill) => {
    if (!isRecord(skill) || (skill.type !== "anthropic" && skill.type !== "custom") || typeof skill.skill_id !== "string") {
      return [];
    }
    return [
      {
        id: crypto.randomUUID(),
        type: skill.type,
        skillId: skill.skill_id,
        version: typeof skill.version === "string" ? skill.version : "",
      },
    ];
  });
}

function subAgentDraftsFromAgent(value: unknown): SubAgentDraft[] {
  if (!isRecord(value) || value.type !== "coordinator" || !Array.isArray(value.agents)) return [];
  return value.agents.flatMap((subAgent) => {
    const agentId = multiagentRosterAgentId(subAgent);
    return agentId ? [{ id: crypto.randomUUID(), agentId }] : [];
  });
}

function agentParameterConfigFromMetadata(metadata: Record<string, string> | undefined): AgentParameterConfig {
  const raw = metadata?.agent_parameter_config;
  if (!raw) return createDefaultAgentParameterConfig();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return createDefaultAgentParameterConfig();
    const parameters = Array.isArray(parsed.parameters)
      ? parsed.parameters.flatMap((parameter): AgentParameterDraft[] => {
          if (!isRecord(parameter)) return [];
          const key = typeof parameter.key === "string" ? parameter.key : "";
          const type = typeof parameter.type === "string" && ["text", "number", "boolean", "select"].includes(parameter.type) ? (parameter.type as AgentParameterType) : "text";
          return [
            {
              id: key || crypto.randomUUID(),
              key,
              label: typeof parameter.label === "string" ? parameter.label : key,
              type,
              defaultValue: typeof parameter.default === "string" ? parameter.default : "",
              description: typeof parameter.description === "string" ? parameter.description : "",
              options: Array.isArray(parameter.options) ? parameter.options.filter((option): option is string => typeof option === "string").join(", ") : "",
            },
          ];
        })
      : [];
    return {
      enabled: parsed.enabled === true,
      allowAdditional: parsed.allow_additional === true,
      parameters,
    };
  } catch {
    return createDefaultAgentParameterConfig();
  }
}

function agentParameterConfigDirty(config: AgentParameterConfig): boolean {
  return config.enabled || config.allowAdditional || config.parameters.length > 0;
}

function comparableAgentParameterConfig(config: AgentParameterConfig): unknown {
  return {
    enabled: config.enabled,
    allowAdditional: config.allowAdditional,
    parameters: config.parameters.map((parameter) => ({
      key: parameter.key.trim(),
      label: parameter.label.trim(),
      type: parameter.type,
      defaultValue: parameter.defaultValue.trim(),
      description: parameter.description.trim(),
      options: selectOptionsFromString(parameter.options),
    })),
  };
}

function serializeAgentParameterMetadata(config: AgentParameterConfig): JsonObject | null {
  if (!agentParameterConfigDirty(config)) return null;
  const keys = new Set<string>();
  const parameters = config.parameters.map((parameter, index) => {
    const key = parameter.key.trim();
    if (!key) throw new Error(`Custom value ${index + 1} needs a key.`);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new Error(`Custom value key "${key}" must use letters, numbers, and underscores.`);
    if (keys.has(key)) throw new Error(`Custom value keys must be unique: ${key}.`);
    keys.add(key);
    const options = selectOptionsFromString(parameter.options);
    if (parameter.type === "select" && options.length === 0) throw new Error(`Custom value ${key} needs select options.`);
    return {
      key,
      label: parameter.label.trim() || key,
      type: parameter.type,
      required: true,
      default: parameter.defaultValue.trim(),
      description: parameter.description.trim(),
      ...(parameter.type === "select" ? { options } : {}),
    };
  });
  const serialized = JSON.stringify({
    enabled: config.enabled,
    allow_additional: config.allowAdditional,
    parameters,
  });
  if (serialized.length > 512) throw new Error("Custom values config is too large for agent metadata.");
  return { agent_parameter_config: serialized };
}

function selectOptionsFromString(value: string): string[] {
  return value
    .split(",")
    .map((option) => option.trim())
    .filter((option, index, options) => option.length > 0 && options.indexOf(option) === index);
}

function buildNodeParams(graph: ProjectGraph, agents: AgentRecord[]): JsonObject {
  const agentById = new Map(agents.map((record) => [record.id, record]));
  const params: JsonObject = {};
  for (const node of graph.nodes) {
    if (node.type !== "agent" || !node.agent_id) continue;
    const record = agentById.get(node.agent_id);
    if (!record) continue;
    const config = agentParameterConfigFromMetadata(record.agent.metadata);
    if (!config.enabled) continue;
    const values = validateNodeParameterValues(node, config, record.agent.name);
    params[node.id] = { agent_id: node.agent_id, values };
  }
  return params;
}

function validateNodeParameterValues(node: ProjectNode, config: AgentParameterConfig, agentName: string): JsonObject {
  const values = node.parameter_values ?? {};
  const result: JsonObject = {};
  const knownKeys = new Set(config.parameters.map((parameter) => parameter.key));
  for (const parameter of config.parameters) {
    const value = values[parameter.key] ?? parameter.defaultValue;
    if (!value.trim()) throw new Error(`${agentName} needs ${parameter.label || parameter.key} on this canvas card.`);
    if (!value.trim()) continue;
    if (parameter.type === "number" && Number.isNaN(Number(value))) throw new Error(`${parameter.label || parameter.key} must be a number.`);
    if (parameter.type === "boolean" && value !== "true" && value !== "false") throw new Error(`${parameter.label || parameter.key} must be true or false.`);
    if (parameter.type === "select" && !selectOptionsFromString(parameter.options).includes(value)) throw new Error(`${parameter.label || parameter.key} must use one of the configured options.`);
    result[parameter.key] = parameter.type === "number" ? Number(value) : parameter.type === "boolean" ? value === "true" : value;
  }
  for (const [key, value] of Object.entries(values)) {
    if (knownKeys.has(key) || !value.trim()) continue;
    if (!config.allowAdditional) throw new Error(`${agentName} does not allow additional custom value "${key}".`);
    result[key] = value;
  }
  return result;
}

function serializeMcpServerDrafts(servers: McpServerDraft[], registeredServers: RegisteredMcpServer[]): JsonObject[] {
  const names = new Set<string>();
  return servers.map((server, index) => {
    if (!server.registryId) throw new Error(`MCP server ${index + 1} must be selected from registered MCP servers.`);
    const registered = registeredServers.find((candidate) => candidate.id === server.registryId);
    if (!registered) throw new Error(`MCP server ${index + 1} is no longer registered.`);
    const name = registered.name.trim();
    const url = registered.url.trim();
    if (!name) throw new Error(`MCP server ${index + 1} needs a name.`);
    if (names.has(name)) throw new Error(`MCP server names must be unique: ${name}.`);
    names.add(name);
    validateUrl(url, `MCP server ${name}`);
    return { type: "url", name, url };
  });
}

function serializeSkillDrafts(skills: SkillDraft[]): JsonObject[] {
  return skills.map((skill, index) => {
    const skillId = skill.skillId.trim();
    const version = skill.version.trim();
    if (!skillId) throw new Error(`Skill ${index + 1} needs a skill ID.`);
    return version ? { type: skill.type, skill_id: skillId, version } : { type: skill.type, skill_id: skillId };
  });
}

function serializeSubAgents(subAgents: SubAgentDraft[]): JsonObject | null {
  if (subAgents.length === 0) return null;
  const ids = new Set<string>();
  const agents = subAgents.map((subAgent, index) => {
    const agentId = subAgent.agentId.trim();
    if (!agentId) throw new Error(`Sub agent ${index + 1} needs an agent.`);
    if (ids.has(agentId)) throw new Error("Sub agents must be unique.");
    ids.add(agentId);
    return agentId;
  });
  return { type: "coordinator", agents };
}

function serializeMcpToolsets(servers: JsonObject[]): JsonObject[] {
  const names = servers.map((server) => (typeof server.name === "string" ? server.name.trim() : "")).filter(Boolean);
  return names.map((name) => ({
    type: "mcp_toolset",
    mcp_server_name: name,
    default_config: {
      enabled: true,
      permission_policy: { type: "always_allow" },
    },
  }));
}

function comparableSkillDrafts(skills: SkillDraft[]): Array<Omit<SkillDraft, "id">> {
  return skills.map(({ type, skillId, version }) => ({ type, skillId, version }));
}

function comparableSubAgentDrafts(subAgents: SubAgentDraft[]): Array<Omit<SubAgentDraft, "id">> {
  return subAgents.map(({ agentId }) => ({ agentId }));
}

function comparableMcpServerDrafts(servers: McpServerDraft[]): Array<Omit<McpServerDraft, "id">> {
  return servers.map(({ registryId, name, url }) => ({ registryId, name, url }));
}

function subAgentIds(value: unknown): string[] {
  if (!isRecord(value) || value.type !== "coordinator" || !Array.isArray(value.agents)) return [];
  return value.agents.flatMap((agent) => {
    const agentId = multiagentRosterAgentId(agent);
    return agentId ? [agentId] : [];
  });
}

function multiagentRosterAgentId(value: unknown): string | null {
  if (typeof value === "string") {
    const id = value.trim();
    return id.length > 0 ? id : null;
  }
  if (!isRecord(value)) return null;
  if (value.type !== "agent") return null;
  if (typeof value.id !== "string") return null;
  const id = value.id.trim();
  return id.length > 0 ? id : null;
}

function validateUrl(value: string, label: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Unsupported protocol");
  } catch {
    throw new Error(`${label} URL must be a valid HTTP URL.`);
  }
}

function memberEmailFor(uuid: string, members: Member[]): string | undefined {
  return members.find((member) => member.uuid === uuid)?.email;
}

function isAgentCreatorByEmail(record: AgentRecord, members: Member[], currentUserEmail: string): boolean {
  const creatorEmail = memberEmailFor(record.creator_uuid, members);
  return creatorEmail ? emailsEqual(creatorEmail, currentUserEmail) : true;
}

function emailsEqual(left: string | undefined | null, right: string | undefined | null): boolean {
  return typeof left === "string" && typeof right === "string" && left.trim().toLowerCase() === right.trim().toLowerCase();
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? value : null;
}

function formatJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function modelLabel(model: unknown): string {
  if (typeof model === "string") return model;
  if (isRecord(model) && typeof model.id === "string") return model.id;
  return "model_config";
}

function modelValue(model: unknown): string {
  return typeof model === "string" ? model : modelLabel(model);
}

function mcpAuthLabel(authType: McpAuthKind): string {
  if (authType === "no_auth") return "No auth";
  if (authType === "static_bearer") return "Static bearer";
  return "Environment value";
}

function mcpScopeLabel(server: RegisteredMcpServer): string {
  if (mcpServerIsGlobal(server)) return "Global";
  const projectCount = (server.project_ids ?? []).length;
  return projectCount === 1 ? "1 project" : `${projectCount} projects`;
}

function vaultScopeLabel(vault: VaultRecord): string {
  if (vault.managed_scope === "global") return "Global";
  if (vault.managed_scope === "project") return vault.project_name ? `Project · ${vault.project_name}` : "Project";
  if (vault.managed_scope === "external") return "External";
  return vault.type;
}

function formatApprovalWait(approvalWait: ChatApprovalWait): string {
  const approvals = approvalWait.approvals.filter((approval): approval is NonNullable<ChatApprovalWait["approvals"][number]> => Boolean(approval));
  if (approvals.length === 0) {
    return `${approvalWait.message} Approve or deny the pending request there, then continue this chat.`;
  }

  const details = approvals
    .map((approval) => {
      if (approval.type === "agent.mcp_tool_use") {
        return `${approval.mcp_server_name ?? "MCP"}:${approval.name ?? approval.id}`;
      }
      return approval.name ? `${approval.type}:${approval.name}` : `${approval.type}:${approval.id}`;
    })
    .join(", ");
  return `${approvalWait.message} Pending: ${details}. Approve or deny it there, then continue this chat.`;
}

function firstToolApproval(approvalWait: ChatApprovalWait): NonNullable<ChatApprovalWait["approvals"][number]> | null {
  return (
    approvalWait.approvals.find(
      (approval): approval is NonNullable<ChatApprovalWait["approvals"][number]> => {
        if (!approval) return false;
        return approval.type === "agent.tool_use" || approval.type === "agent.mcp_tool_use";
      },
    ) ?? null
  );
}

function credentialAuthLabel(auth: VaultCredential["auth"]): string {
  if (auth.type === "static_bearer" && typeof auth.mcp_server_url === "string") {
    return `Static bearer · ${auth.mcp_server_url}`;
  }
  if (auth.type === "mcp_oauth" && typeof auth.mcp_server_url === "string") {
    return `MCP OAuth · ${auth.mcp_server_url}`;
  }
  if (auth.type === "environment_variable" && typeof auth.secret_name === "string") {
    return `Environment variable · ${auth.secret_name}`;
  }
  return auth.type;
}

function deploymentAgentId(deployment: AnthropicDeployment): string {
  return typeof deployment.agent?.id === "string" ? deployment.agent.id : "";
}

function deploymentAgentName(deployment: AnthropicDeployment, agents: AgentRecord[]): string {
  const agentId = deploymentAgentId(deployment);
  return agents.find((record) => record.id === agentId)?.agent.name ?? deployment.agent.name ?? shortId(agentId);
}

function environmentNameFor(environmentId: string, environments: AnthropicEnvironment[]): string {
  return environments.find((environment) => environment.id === environmentId)?.name ?? shortId(environmentId);
}

function deploymentInitialMessage(events: unknown[] | undefined): string {
  if (!Array.isArray(events)) return "";
  const userMessage = events.find((event) => isRecord(event) && event.type === "user.message" && Array.isArray(event.content));
  if (!isRecord(userMessage) || !Array.isArray(userMessage.content)) return "";
  return userMessage.content
    .map((block) => (isRecord(block) && block.type === "text" && typeof block.text === "string" ? block.text : ""))
    .join("")
    .trim();
}

function deploymentInitialEvents(message: string): JsonObject[] {
  return [
    {
      type: "user.message",
      content: [{ type: "text", text: message }],
    },
  ];
}

function deploymentScheduleDraft(schedule: unknown): ScheduleDraft {
  if (isRecord(schedule) && schedule.type === "cron") {
    const expression = typeof schedule.expression === "string" ? schedule.expression : "0 9 * * *";
    const parsed = scheduleDraftFromCronExpression(expression);
    return {
      ...parsed,
      expression,
      timezone: typeof schedule.timezone === "string" ? schedule.timezone : "UTC",
    };
  }
  return { mode: "days", interval: 1, minute: 0, hour: 9, dayOfWeek: 1, expression: "0 9 * * *", timezone: "UTC" };
}

function createDefaultScheduleDraft(): ScheduleDraft {
  return deploymentScheduleDraft(null);
}

function createDefaultSlackTriggerDraft(): SlackTriggerDraft {
  return { type: "none" };
}

function createSlackTriggerDraft(type: SlackTriggerType, current: SlackTriggerDraft = createDefaultSlackTriggerDraft(), nextValue?: string): SlackTriggerDraft {
  if (type === "none" || type === "all") return { type };
  if (type === "channel") return { type, channel_id: nextValue ?? current.channel_id ?? "" };
  if (type === "user") return { type, user_id: nextValue ?? current.user_id ?? "" };
  return { type, keyword: nextValue ?? current.keyword ?? "" };
}

function scheduleDraftFromCronExpression(expression: string): Omit<ScheduleDraft, "timezone"> {
  const fallback = { mode: "cron" as const, interval: 1, minute: 0, hour: 9, dayOfWeek: 1, expression };
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return fallback;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const parsedMinute = parseCronNumber(minute, 0, 59);
  if (parsedMinute === null || month !== "*") return fallback;

  const hourStep = hour.match(/^\*\/(\d+)$/);
  if (hourStep && dayOfMonth === "*" && dayOfWeek === "*") {
    return { mode: "hours", interval: clamp(Number(hourStep[1]), 1, 23), minute: parsedMinute, hour: 9, dayOfWeek: 1, expression };
  }

  const parsedHour = parseCronNumber(hour, 0, 23);
  if (parsedHour === null) return fallback;

  const dayStep = dayOfMonth.match(/^\*\/(\d+)$/);
  if (dayStep && dayOfWeek === "*") {
    return { mode: "days", interval: clamp(Number(dayStep[1]), 1, 31), minute: parsedMinute, hour: parsedHour, dayOfWeek: 1, expression };
  }

  const parsedDayOfWeek = parseCronNumber(dayOfWeek, 0, 7);
  if (dayOfMonth === "*" && parsedDayOfWeek !== null) {
    return { mode: "weeks", interval: 1, minute: parsedMinute, hour: parsedHour, dayOfWeek: parsedDayOfWeek === 0 ? 7 : parsedDayOfWeek, expression };
  }

  return fallback;
}

function cronExpressionForSchedule(draft: ScheduleDraft): string {
  if (!draft.timezone.trim()) throw new Error("Schedule timezone is required.");

  if (draft.mode === "cron") {
    const expression = draft.expression.trim();
    if (expression.split(/\s+/).length !== 5) throw new Error("Cron expression must have 5 fields.");
    return expression;
  }

  const interval = clamp(Math.trunc(draft.interval), 1, scheduleIntervalMax(draft.mode));
  const minute = clamp(Math.trunc(draft.minute), 0, 59);
  if (draft.mode === "hours") {
    return `${minute} */${interval} * * *`;
  }

  const hour = clamp(Math.trunc(draft.hour), 0, 23);
  if (draft.mode === "days") {
    return `${minute} ${hour} */${interval} * *`;
  }

  const dayOfWeek = clamp(Math.trunc(draft.dayOfWeek), 1, 7);
  if (interval === 1) {
    return `${minute} ${hour} * * ${dayOfWeek}`;
  }
  return `${minute} ${hour} */${interval * 7} * *`;
}

function cronExpressionPreview(draft: ScheduleDraft): string {
  try {
    return cronExpressionForSchedule(draft);
  } catch {
    return "Invalid schedule";
  }
}

function scheduleIntervalMax(mode: ScheduleMode): number {
  if (mode === "hours") return 23;
  if (mode === "weeks") return 4;
  return 31;
}

function parseCronNumber(value: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function numberFromInput(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function timeInputValue(hour: number, minute: number): string {
  return `${String(clamp(Math.trunc(hour), 0, 23)).padStart(2, "0")}:${String(clamp(Math.trunc(minute), 0, 59)).padStart(2, "0")}`;
}

function parseTimeInput(value: string): { hour: number; minute: number } {
  const [hour = "0", minute = "0"] = value.split(":");
  return {
    hour: clamp(numberFromInput(hour, 0), 0, 23),
    minute: clamp(numberFromInput(minute, 0), 0, 59),
  };
}

function weekdays(): Array<{ value: number; label: string }> {
  return [
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
    { value: 6, label: "Saturday" },
    { value: 7, label: "Sunday" },
  ];
}

function sortAgents(records: AgentRecord[]): AgentRecord[] {
  return [...records].sort((left, right) => {
    const leftMaster = isMasterAgent(left);
    const rightMaster = isMasterAgent(right);
    if (leftMaster !== rightMaster) return leftMaster ? -1 : 1;
    return 0;
  });
}

function isMasterAgent(record: AgentRecord): boolean {
  return record.agent.name.trim().toLowerCase() === "master";
}

function shortId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function latestSessionsFirst(sessions: ManagedSession[]): ManagedSession[] {
  return [...sessions].sort((a, b) => sessionSortTimestamp(b) - sessionSortTimestamp(a));
}

function sessionSortTimestamp(session: ManagedSession): number {
  const updatedAt = Date.parse(session.updated_at);
  if (Number.isFinite(updatedAt)) return updatedAt;
  const createdAt = Date.parse(session.created_at);
  return Number.isFinite(createdAt) ? createdAt : 0;
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function toggleArrayValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function chatKey(agentId: string, environmentId: string, vaultIds: string[]): string {
  return `${agentId}:${environmentId}:${[...vaultIds].sort().join(",")}`;
}

function isStoppableSession(session: ManagedSession | null | undefined): session is ManagedSession {
  return session?.status === "running" || session?.status === "rescheduling";
}

interface ManagedSessionUsageTotals {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
  total: number;
}

interface ModelPricingUsdPerMtok {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
}

const managedAgentRuntimeUsdPerHour = 0.08;
const sonnet5PriceChangeAtMs = Date.UTC(2026, 8, 1);
const sonnet5IntroPricing: ModelPricingUsdPerMtok = { input: 2, output: 10, cacheRead: 0.2, cacheWrite5m: 2.5, cacheWrite1h: 4 };
const sonnet5StandardPricing: ModelPricingUsdPerMtok = { input: 3, output: 15, cacheRead: 0.3, cacheWrite5m: 3.75, cacheWrite1h: 6 };
const fable5Pricing: ModelPricingUsdPerMtok = { input: 10, output: 50, cacheRead: 1, cacheWrite5m: 12.5, cacheWrite1h: 20 };
const opus5Pricing: ModelPricingUsdPerMtok = { input: 5, output: 25, cacheRead: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10 };
const opus4Pricing: ModelPricingUsdPerMtok = { input: 15, output: 75, cacheRead: 1.5, cacheWrite5m: 18.75, cacheWrite1h: 30 };
const sonnetPricing: ModelPricingUsdPerMtok = { input: 3, output: 15, cacheRead: 0.3, cacheWrite5m: 3.75, cacheWrite1h: 6 };
const haiku45Pricing: ModelPricingUsdPerMtok = { input: 1, output: 5, cacheRead: 0.1, cacheWrite5m: 1.25, cacheWrite1h: 2 };
const haiku35Pricing: ModelPricingUsdPerMtok = { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite5m: 1, cacheWrite1h: 1.6 };

const modelListPricingUsdPerMtok: Record<string, ModelPricingUsdPerMtok> = {
  "claude-fable-5": fable5Pricing,
  "claude-mythos-5": fable5Pricing,
  "claude-opus-5": opus5Pricing,
  "claude-opus-4-8": opus5Pricing,
  "claude-opus-4-7": opus5Pricing,
  "claude-opus-4-6": opus5Pricing,
  "claude-opus-4-5": opus5Pricing,
  "claude-opus-4-1": opus4Pricing,
  "claude-opus-4": opus4Pricing,
  "claude-sonnet-4-6": sonnetPricing,
  "claude-sonnet-4-5": sonnetPricing,
  "claude-sonnet-4": sonnetPricing,
  "claude-3-7-sonnet": sonnetPricing,
  "claude-3-5-sonnet": sonnetPricing,
  "claude-haiku-4-5": haiku45Pricing,
  "claude-haiku-3-5": haiku35Pricing,
  "claude-3-5-haiku": haiku35Pricing,
};

const modelPricingPrefixes = Object.keys(modelListPricingUsdPerMtok).sort((left, right) => right.length - left.length);

function sessionModelId(session: ManagedSession): string | null {
  const model = session.agent.model;
  if (typeof model === "string") return model;
  if (model && typeof model.id === "string" && model.id.trim()) return model.id;
  return null;
}

function pricingForModel(modelId: string | null): ModelPricingUsdPerMtok | null {
  if (!modelId) return null;
  const normalizedModelId = modelId.toLowerCase();
  if (normalizedModelId.startsWith("claude-sonnet-5")) {
    return Date.now() < sonnet5PriceChangeAtMs ? sonnet5IntroPricing : sonnet5StandardPricing;
  }
  const exactPricing = modelListPricingUsdPerMtok[normalizedModelId];
  if (exactPricing) return exactPricing;
  const prefix = modelPricingPrefixes.find((candidate) => normalizedModelId.startsWith(candidate));
  return prefix ? modelListPricingUsdPerMtok[prefix] : null;
}

function sessionUsageTotals(usage: ManagedSession["usage"]): ManagedSessionUsageTotals | null {
  if (!usage) return null;
  const input = finiteNumberOrZero(usage.input_tokens);
  const output = finiteNumberOrZero(usage.output_tokens);
  const cacheRead = finiteNumberOrZero(usage.cache_read_input_tokens);
  const cacheWrite5m = finiteNumberOrZero(usage.cache_creation?.ephemeral_5m_input_tokens);
  const cacheWrite1h = finiteNumberOrZero(usage.cache_creation?.ephemeral_1h_input_tokens);
  return {
    input,
    output,
    cacheRead,
    cacheWrite5m,
    cacheWrite1h,
    total: input + output + cacheRead + cacheWrite5m + cacheWrite1h,
  };
}

function estimateManagedSessionCost(session: ManagedSession): {
  tokenCostUsd: number | null;
  runtimeCostUsd: number | null;
  totalCostUsd: number | null;
  pricingAvailable: boolean;
} {
  const pricing = pricingForModel(sessionModelId(session));
  const usage = sessionUsageTotals(session.usage);
  const tokenCostUsd = pricing && usage
    ? (
        (usage.input * pricing.input)
        + (usage.output * pricing.output)
        + (usage.cacheRead * pricing.cacheRead)
        + (usage.cacheWrite5m * pricing.cacheWrite5m)
        + (usage.cacheWrite1h * pricing.cacheWrite1h)
      ) / 1_000_000
    : null;
  const activeSeconds = finiteNumberOrNull(session.stats?.active_seconds);
  const runtimeCostUsd = activeSeconds === null ? null : (activeSeconds / 3600) * managedAgentRuntimeUsdPerHour;
  const totalCostUsd = tokenCostUsd === null && runtimeCostUsd === null ? null : (tokenCostUsd ?? 0) + (runtimeCostUsd ?? 0);
  return {
    tokenCostUsd,
    runtimeCostUsd,
    totalCostUsd,
    pricingAvailable: Boolean(pricing),
  };
}

function finiteNumberOrZero(value: number | null | undefined): number {
  return finiteNumberOrNull(value) ?? 0;
}

function finiteNumberOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatSessionStatus(status: ManagedSession["status"]): string {
  if (status === "rescheduling") return "Rescheduling";
  if (status === "running") return "Running";
  if (status === "idle") return "Idle";
  return "Terminated";
}

function formatSessionDuration(value: number | null | undefined): string {
  const seconds = finiteNumberOrNull(value);
  if (seconds === null) return "Unavailable";
  const roundedSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(roundedSeconds / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);
  const remainderSeconds = roundedSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remainderSeconds}s`;
  return `${remainderSeconds}s`;
}

function formatTokenCount(value: number | null): string {
  if (value === null) return "Unavailable";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function formatUsd(value: number | null): string {
  if (value === null) return "Unavailable";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value >= 1 ? 2 : 4,
    maximumFractionDigits: value >= 1 ? 2 : 6,
  }).format(value);
}

function defaultEnvironmentConfig(kind: EnvironmentKind): JsonObject {
  if (kind === "self_hosted") {
    return { type: "self_hosted" };
  }

  return {
    type: "cloud",
    networking: { type: "unrestricted" },
    packages: { type: "packages", pip: [], npm: [], apt: [], cargo: [], gem: [], go: [] },
  };
}

function environmentForProject(project: ProjectRecord, environments: AnthropicEnvironment[]): AnthropicEnvironment | null {
  return environments.find((environment) => environment.id === project.anthropic_environment_id) ?? null;
}

function environmentHasPackage(environment: AnthropicEnvironment | null | undefined, packagePreset: PackagePresetRecord): boolean {
  if (!environment || !isRecord(environment.config.packages)) return false;
  const values = environment.config.packages[packagePreset.target];
  return Array.isArray(values) && values.includes(packagePreset.package_name);
}

function packagePresetInstalled(packagePreset: PackagePresetRecord, environment: AnthropicEnvironment | null | undefined, credentials: VaultCredential[]): boolean {
  return environmentHasPackage(environment, packagePreset) && packageRequiredEnvironmentCredentialsInstalled(packagePreset, credentials);
}

function packageRequiredEnvironmentCredentialsInstalled(packagePreset: PackagePresetRecord, credentials: VaultCredential[]): boolean {
  return packagePreset.environment_variables.every((name) => vaultHasEnvironmentCredential(credentials, name));
}

function vaultHasEnvironmentCredential(credentials: VaultCredential[], secretName: string): boolean {
  const normalizedSecretName = secretName.trim();
  if (!normalizedSecretName) return false;
  return activeVaultCredentials(credentials).some((credential) =>
    credential.auth.type === "environment_variable" &&
    stringValue(credential.auth.secret_name)?.trim() === normalizedSecretName,
  );
}

function packageEnvSummary(packagePreset: PackagePresetRecord): string {
  const count = packagePreset.environment_variables.length;
  return count > 0 ? `${count} env value${count === 1 ? "" : "s"} required` : "";
}

function environmentValuesForPackagePreset(packagePreset: PackagePresetRecord): Record<string, string> {
  return Object.fromEntries(packagePreset.environment_variables.map((name) => [name, ""]));
}

function packageEnvironmentValuesMissing(packagePreset: PackagePresetRecord, values: Record<string, string>, credentials: VaultCredential[] = []): boolean {
  return packagePreset.environment_variables.some((name) => !vaultHasEnvironmentCredential(credentials, name) && !values[name]?.trim());
}

function environmentPackageSummary(environment: AnthropicEnvironment): string {
  const packages = isRecord(environment.config.packages) ? environment.config.packages : null;
  if (!packages) return "";

  const parts = packageManagers.flatMap((manager) => {
    const values = packages[manager];
    return Array.isArray(values) && values.length > 0 ? [`${manager} ${values.length}`] : [];
  });
  return parts.join(" · ");
}

function environmentPackageRowsFromSpec(spec: string): Array<{ manager: PackageManager; packages: string[] }> {
  try {
    const config = parseJsonObject(spec, "Spec file");
    const packages = isRecord(config.packages) ? config.packages : null;
    if (!packages) return [];
    return packageManagers.flatMap((manager) => {
      const values = packages[manager];
      return Array.isArray(values) && values.length > 0
        ? [{ manager, packages: values.map((value) => String(value)) }]
        : [];
    });
  } catch {
    return [];
  }
}

function themeVariables(): React.CSSProperties & Record<`--${string}`, string | number> {
  return {
    "--page-bg": componentRecipe.page.background,
    "--canvas-bg": appShellRecipe.mainBackground,
    "--surface-bg": componentRecipe.card.background,
    "--surface-hover": designTokens.rawColors.background.surfaceHover,
    "--surface-selected": designTokens.rawColors.background.surfaceSelected,
    "--primary-text": componentRecipe.page.color,
    "--secondary-text": designTokens.colors.secondaryText,
    "--placeholder-text": designTokens.colors.placeholderText,
    "--inverse-text": designTokens.rawColors.foreground.inverse,
    "--brand": designTokens.colors.brand,
    "--brand-hover": designTokens.rawColors.brand.hover,
    "--brand-surface": appShellRecipe.activeNavBackground,
    "--brand-border": designTokens.rawColors.brand.border,
    "--border": designTokens.colors.border,
    "--border-subtle": designTokens.colors.headerBorder,
    "--border-hover": designTokens.rawColors.border.hover,
    "--focus-ring": designTokens.colors.focusRing,
    "--primary-button-bg": buttonRecipe.primary.background,
    "--primary-button-hover": String(buttonRecipe.primary.hoverBackground),
    "--primary-button-active": String(buttonRecipe.primary.activeBackground),
    "--primary-button-text": buttonRecipe.primary.color,
    "--secondary-button-bg": buttonRecipe.secondary.background,
    "--secondary-button-text": buttonRecipe.secondary.color,
    "--secondary-button-border": designTokens.rawColors.button.secondaryBorder,
    "--secondary-button-hover-border": String(buttonRecipe.secondary.hoverBorderColor),
    "--secondary-button-active-bg": String(buttonRecipe.secondary.activeBackground),
    "--disabled-bg": String(buttonRecipe.primary.disabledBackground),
    "--disabled-text": String(buttonRecipe.primary.disabledColor),
    "--danger-bg": buttonRecipe.dangerPrimary.background,
    "--danger-hover": String(buttonRecipe.dangerPrimary.hoverBackground),
    "--danger-active": String(buttonRecipe.dangerPrimary.activeBackground),
    "--danger-text": buttonRecipe.dangerPrimary.color,
    "--danger-soft": badgeRecipe.danger.background,
    "--danger-fg": designTokens.rawColors.semantic.danger.fg,
    "--success-soft": badgeRecipe.success.background,
    "--success-fg": badgeRecipe.success.color,
    "--info-soft": badgeRecipe.info.background,
    "--info-fg": badgeRecipe.info.color,
    "--input-bg": inputRecipe.default.background,
    "--input-border": designTokens.rawColors.border.default,
    "--input-active-bg": designTokens.rawColors.background.searchActive,
    "--card-radius": `${cardRecipe.default.borderRadius}px`,
    "--modal-radius": `${overlayRecipe.modal.borderRadius}px`,
    "--button-radius": `${buttonRecipe.primary.borderRadius}px`,
    "--input-radius": `${inputRecipe.default.borderRadius}px`,
    "--badge-radius": `${badgeRecipe.info.borderRadius}px`,
    "--button-height": `${buttonRecipe.primary.minHeight}px`,
    "--input-height": `${inputRecipe.default.minHeight}px`,
    "--sidebar-width": `${appShellRecipe.sidebarWidth}px`,
    "--modal-shadow": overlayRecipe.modal.boxShadow,
    "--popover-shadow": overlayRecipe.toast.boxShadow,
    "--table-header-bg": tableRecipe.header.background,
    "--table-row-border": tableRecipe.row.borderBottom,
    "--table-row-hover": tableRecipe.row.hoverBackground,
    "--motion-hover": designTokens.motion.hover,
    "--motion-base": designTokens.motion.base,
    "--font-product": `${designTokens.typography.fontFamily}, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
    "--font-mono": `${designTokens.typography.raw.mono.family}, "SFMono-Regular", Consolas, "Liberation Mono", monospace`,
  };
}

type CanvasLocalGlobal = typeof globalThis & {
  __canvasLocalRoot?: ReturnType<typeof createRoot>;
};

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Raddus Canvas root element is missing.");
const canvasLocalGlobal = globalThis as CanvasLocalGlobal;
const canvasLocalRoot = canvasLocalGlobal.__canvasLocalRoot ?? createRoot(rootElement);
canvasLocalGlobal.__canvasLocalRoot = canvasLocalRoot;
canvasLocalRoot.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
