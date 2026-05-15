import { useEffect, useState } from 'react'
import { ref, onValue, set, remove } from 'firebase/database'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, database } from '../firebase/config'

/**
 * Hook to manage user's saved projects
 * Projects are stored at /users/{uid}/projects/{projectId}
 * @returns {{ projects: Array, saveProject, deleteProject, isLoading: boolean }}
 */
export function useUserProjects() {
  const [user, setUser] = useState(null)
  const [projects, setProjects] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Listen to auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      if (!nextUser) {
        setProjects([])
        setIsLoading(false)
      }
    })
    return () => unsubscribe()
  }, [])

  // Listen to user's projects
  useEffect(() => {
    if (!user) {
      setIsLoading(false)
      return
    }

    const projectsRef = ref(database, `users/${user.uid}/projects`)
    const unsubscribe = onValue(projectsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        const projectList = Object.entries(data).map(([projectId, projectData]) => ({
          projectId,
          ...projectData
        }))
        setProjects(projectList)
      } else {
        setProjects([])
      }
      setIsLoading(false)
    })

    return () => unsubscribe()
  }, [user])

  const saveProject = async (projectId, projectData) => {
    if (!user) {
      throw new Error('User not authenticated')
    }

    const projectRef = ref(database, `users/${user.uid}/projects/${projectId}`)
    await set(projectRef, {
      ...projectData,
      createdAt: projectData.createdAt || new Date().toISOString(),
      lastEditedAt: new Date().toISOString(),
      userId: user.uid
    })
  }

  const deleteProject = async (projectId) => {
    if (!user) {
      throw new Error('User not authenticated')
    }

    const projectRef = ref(database, `users/${user.uid}/projects/${projectId}`)
    await remove(projectRef)
  }

  return { projects, saveProject, deleteProject, isLoading, user }
}
