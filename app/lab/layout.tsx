import {LabProvider} from "./lab-context";
import {LabShell} from "./lab-shell";
export default function Layout({children}:{children:React.ReactNode}){return <LabProvider><LabShell>{children}</LabShell></LabProvider>}
