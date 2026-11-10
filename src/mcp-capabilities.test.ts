import {afterEach,expect,it,vi} from "vitest";
afterEach(()=>{vi.unstubAllEnvs();vi.resetModules();});
it("does not load stored custom server credentials in packaged Even Hub builds",async()=>{
 vi.stubEnv("MODE","evenhub");vi.stubEnv("DEV",false);vi.resetModules();
 const {resolveMcpServers}=await import("./mcp-servers");const getLocalStorage=vi.fn(async()=>"private saved settings");
 await expect(resolveMcpServers({getLocalStorage,setLocalStorage:async()=>true})).resolves.toEqual([]);
 expect(getLocalStorage).not.toHaveBeenCalled();
});
it("retains custom MCP availability for developer builds",async()=>{
 vi.stubEnv("MODE","development");vi.stubEnv("DEV",true);vi.resetModules();
 const {CUSTOM_MCP_AVAILABLE}=await import("./mcp-capabilities");expect(CUSTOM_MCP_AVAILABLE).toBe(true);
});
