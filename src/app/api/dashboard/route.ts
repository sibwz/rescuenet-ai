import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'

export const dynamic = 'force-dynamic'
import EmergencyRequest from '@/models/EmergencyRequest'
import Volunteer from '@/models/Volunteer'
import Resource from '@/models/Resource'
import Mission from '@/models/Mission'

export async function GET() {
  try {
    await connectDB()

    const [
      totalRequests,
      criticalRequests,
      availableVolunteers,
      availableResources,
      activeMissions,
      byTypeRaw,
      byUrgencyRaw,
      peopleHelpedRaw,
      missionStatusRaw,
      resourceUtilRaw,
    ] = await Promise.all([
      EmergencyRequest.countDocuments(),
      EmergencyRequest.countDocuments({ urgency: 'critical', status: { $ne: 'completed' } }),
      Volunteer.countDocuments({ status: 'available' }),
      Resource.countDocuments({ status: 'available' }),
      Mission.countDocuments({ status: 'active' }),

      // Emergency count by type
      EmergencyRequest.aggregate([
        { $group: { _id: '$emergencyType', count: { $sum: 1 }, people: { $sum: '$peopleAffected' } } },
        { $sort: { count: -1 } },
      ]),

      // Emergency count by urgency (pending only)
      EmergencyRequest.aggregate([
        { $match: { status: 'pending' } },
        { $group: { _id: '$urgency', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Total people helped via completed missions (join to emergency request)
      EmergencyRequest.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$peopleAffected' } } },
      ]),

      // Mission status breakdown
      Mission.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // Resource utilization: available vs assigned vs depleted
      Resource.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, totalQty: { $sum: '$quantity' } } },
      ]),
    ])

    const emergencyByType = byTypeRaw.map((r: { _id: string; count: number; people: number }) => ({
      type: r._id,
      count: r.count,
      peopleAffected: r.people,
    }))

    const urgencyBreakdown = byUrgencyRaw.reduce(
      (acc: Record<string, number>, r: { _id: string; count: number }) => {
        acc[r._id] = r.count
        return acc
      },
      {} as Record<string, number>
    )

    const peopleHelped = (peopleHelpedRaw[0] as { total: number } | undefined)?.total ?? 0

    const missionStatus = missionStatusRaw.reduce(
      (acc: Record<string, number>, r: { _id: string; count: number }) => {
        acc[r._id] = r.count
        return acc
      },
      {} as Record<string, number>
    )

    const missionStatusTyped = missionStatus as Record<string, number>
    const totalMissions = Object.values(missionStatusTyped).reduce((a: number, b: number) => a + b, 0)
    const completedMissions = missionStatusTyped['completed'] ?? 0
    const missionCompletionRate =
      totalMissions > 0 ? Math.round((completedMissions / totalMissions) * 100) : 0

    const resourceUtilization = resourceUtilRaw.reduce(
      (acc: Record<string, number>, r: { _id: string; count: number }) => {
        acc[r._id] = r.count
        return acc
      },
      {} as Record<string, number>
    )

    const totalVolunteers = await Volunteer.countDocuments()
    const busyVolunteers = await Volunteer.countDocuments({ status: 'busy' })
    const volunteerUtilRate =
      totalVolunteers > 0 ? Math.round((busyVolunteers / totalVolunteers) * 100) : 0

    return NextResponse.json({
      totalRequests,
      criticalRequests,
      availableVolunteers,
      availableResources,
      activeMissions,
      // Aggregation analytics
      analytics: {
        emergencyByType,
        urgencyBreakdown,
        peopleHelped,
        missionStatus,
        missionCompletionRate,
        resourceUtilization,
        volunteerUtilRate,
        totalVolunteers,
        busyVolunteers,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
