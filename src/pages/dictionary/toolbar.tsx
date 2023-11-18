import { Button } from "antd"
import { useEffect } from "react"

export const Toolbar = () => {
  const exportOnClick = () => {
    (window as any).ipcRenderer.invoke('open-file-dialog-for-dictionary')
  }
  useEffect(() => {
  }, [])
  return <>
    <Button onClick={exportOnClick}> 导入字典 </Button>
  </>
}

