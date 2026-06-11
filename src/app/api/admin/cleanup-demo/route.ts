import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { isDbConnectionError, dbOfflineResponse } from '@/lib/db-error'
import EmergencyRequest from '@/models/EmergencyRequest'
import Volunteer from '@/models/Volunteer'
import Resource from '@/models/Resource'
import Mission from '@/models/Mission'
import AgentLog from '@/models/AgentLog'
import { isLocationTooVague } from '@/lib/location-validator'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    await connectDB()

    const [eDel, vDel, rDel] = await Promise.all([
      EmergencyRequest.deleteMany({ source: 'demo' }),
      Volunteer.deleteMany({ source: 'demo' }),
      Resource.deleteMany({ source: 'demo' }),
    ])

    // Also delete missions referencing deleted emergencies (missions don't have source)
    // Just clean up missions with no emergency
    const allMissions = await Mission.find().lean()
    const allEmergencyIds = new Set(
      (await EmergencyRequest.find().select('_id').lean()).map((e) => String(e._id))
    )
    const orphanMissionIds = allMissions
      .filter((m) => !allEmergencyIds.has(String(m.emergencyRequestId)))
      .map((m) => String(m._id))
    if (orphanMissionIds.length > 0) {
      await Mission.deleteMany({ _id: { $in: orphanMissionIds } })
    }

    // ── Assess location precision for existing records without it ────────
    const unassessedResources = await Resource.find({
      source: { $ne: 'demo' },
      dispatchEligible: null,
    }).lean()
    let resAssessed = 0
    for (const r of unassessedResources) {
      const hasGPS = !!(r.latitude && r.longitude)
      const tooVague = !hasGPS && isLocationTooVague(r.location)
      await Resource.findByIdAndUpdate(r._id, {
        locationPrecision: hasGPS ? 'exact' : (tooVague ? 'city_only' : 'area'),
        locationVerified: hasGPS || !tooVague,
        dispatchEligible: hasGPS || !tooVague,
      })
      resAssessed++
    }

    const unassessedVolunteers = await Volunteer.find({
      source: { $ne: 'demo' },
      locationPrecision: null,
    }).lean()
    let volAssessed = 0
    for (const v of unassessedVolunteers) {
      const hasGPS = !!(v.latitude && v.longitude && v.locationValidated)
      const tooVague = !hasGPS && isLocationTooVague(v.location)
      await Volunteer.findByIdAndUpdate(v._id, {
        locationPrecision: hasGPS ? 'exact' : (tooVague ? 'city_only' : 'area'),
      })
      volAssessed++
    }

    await AgentLog.create({
      action: 'DEMO_DATA_CLEARED',
      details: `Admin cleared demo data. Emergencies: ${eDel.deletedCount}, Volunteers: ${vDel.deletedCount}, Resources: ${rDel.deletedCount}, Orphan missions: ${orphanMissionIds.length}. Assessed location precision: ${resAssessed} resources, ${volAssessed} volunteers.`,
      relatedIds: [],
    })

    return NextResponse.json({
      success: true,
      deleted: {
        emergencies: eDel.deletedCount,
        volunteers: vDel.deletedCount,
        resources: rDel.deletedCount,
        missions: orphanMissionIds.length,
      },
      assessed: { resources: resAssessed, volunteers: volAssessed },
      message: `Removed ${eDel.deletedCount} demo emergencies, ${vDel.deletedCount} demo volunteers, ${rDel.deletedCount} demo resources. Location precision assessed for ${resAssessed} resource depots and ${volAssessed} volunteers.`,
    })
  } catch (error) {
    if (isDbConnectionError(error)) return dbOfflineResponse()
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
